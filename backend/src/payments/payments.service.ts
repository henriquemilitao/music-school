import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { PAYMENT_PROVIDER } from './payments.constants';
import type { PaymentProvider } from './providers/payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
  ) {}

  private readonly PIX_EXPIRATION_SECONDS = 15 * 60; // 15 minutos

  // ─── Aluno ──────────────────────────────────────────────────

  // Sem studentId: retorna as faturas de TODOS os students vinculados
  // a esse usuário (cobre o caso "sou o próprio aluno", "sou pai de 1
  // ou N filhos", ou "sou 1 pessoa com N matrículas/instrumentos").
  // Com studentId: filtra só aquele, útil se o front quiser abas por aluno.
  async findMyPayments(userId: string, studentId?: string) {
    const students = await this.prisma.student.findMany({
      where: { userId, ...(studentId ? { id: studentId } : {}) },
      select: { id: true },
    });
    if (!students.length) return [];

    const studentIds = students.map((s) => s.id);

    const payments = await this.prisma.payment.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: { referenceMonth: 'desc' },
      select: {
        id: true,
        studentId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        paidAt: true,
        status: true,
        referenceMonth: true,
        checkoutUrl: true,
        pixCopyPaste: true,
        pixQrCode: true,
        paymentBundleId: true,
        student: {
          select: { name: true },
        },
      },
    });

    return this.attachEligibility(payments);
  }

  // Anexa isEligibleForPayment/blockingPaymentId a uma lista de
  // faturas de POSSIVELMENTE VÁRIOS alunos (usado em /payments/my,
  // que traz todos os filhos de um responsável de uma vez).
  // Faturas pagas recebem null nos dois campos ("não se aplica").
  private attachEligibility<
    T extends {
      id: string;
      studentId: string;
      dueDate: Date;
      status: string;
    },
  >(payments: T[]) {
    const openByStudent = new Map<string, T[]>();
    for (const p of payments) {
      if (p.status === 'PAID') continue;
      if (!openByStudent.has(p.studentId)) openByStudent.set(p.studentId, []);
      openByStudent.get(p.studentId)!.push(p);
    }
    for (const list of openByStudent.values()) {
      list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    }

    return payments.map((p) => {
      if (p.status === 'PAID') {
        return { ...p, isEligibleForPayment: null, blockingPaymentId: null };
      }

      const openList = openByStudent.get(p.studentId) ?? [];
      const idx = openList.findIndex((x) => x.id === p.id);
      const isOldest = idx === 0;

      return {
        ...p,
        isEligibleForPayment: isOldest,
        blockingPaymentId: isOldest ? null : openList[0].id,
      };
    });
  }

  // GET /payments/my/:id — busca uma fatura específica, mas só se
  // pertencer a um student vinculado ao usuário logado (evita que um
  // aluno veja a fatura de outro só trocando o id na URL)
  // GET /payments/my/:id — SÓ LEITURA, nunca gera PIX. Usado pela tela
  // de "Ver detalhes", que só quer mostrar informação, não iniciar
  // cobrança.
  async findMyPaymentById(paymentId: string, userId: string) {
    const existing = await this.prisma.payment.findFirst({
      where: { id: paymentId, student: { userId } },
      select: { id: true, studentId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Pagamento não encontrado');

    const oldestOpen =
      existing.status === 'PAID'
        ? null
        : await this.findOldestOpenPayment(existing.studentId);
    const isOldest =
      existing.status === 'PAID' ? null : oldestOpen?.id === existing.id;

    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: {
        id: true,
        studentId: true,
        amount: true,
        paidAmount: true,
        dueDate: true,
        paidAt: true,
        status: true,
        referenceMonth: true,
        checkoutUrl: true,
        pixCopyPaste: true,
        pixQrCode: true,
        pixExpiresAt: true,
        paymentBundleId: true,
        student: { select: { name: true } },
      },
    });

    return {
      ...payment,
      isEligibleForPayment: isOldest,
      blockingPaymentId: isOldest === false ? (oldestOpen?.id ?? null) : null,
    };
  }

  // POST/GET /payments/my/:id/charge — GERA/GARANTE o PIX. Usado pela
  // tela de checkout ("Gerar PIX"), a única que deve efetivamente criar
  // cobrança no gateway.
  async getOrCreateMyPaymentCharge(paymentId: string, userId: string) {
    const existing = await this.prisma.payment.findFirst({
      where: { id: paymentId, student: { userId } },
      select: { id: true, studentId: true, status: true },
    });
    if (!existing) throw new NotFoundException('Pagamento não encontrado');

    if (existing.status === 'PAID') {
      throw new BadRequestException('Essa fatura já foi paga');
    }

    const oldestOpen = await this.findOldestOpenPayment(existing.studentId);
    const isOldest = oldestOpen?.id === existing.id;

    if (!isOldest) {
      throw new BadRequestException(
        'Existe uma fatura mais antiga em aberto — pague-a primeiro',
      );
    }

    const payment = await this.ensurePaymentCharge(paymentId);

    return {
      ...payment,
      isEligibleForPayment: true,
      blockingPaymentId: null,
    };
  }

  // Fatura em aberto (PENDING/OVERDUE) mais antiga de um aluno —
  // é a única elegível pra pagamento individual imediato, por causa
  // da regra de ordem cronológica por aluno.
  private async findOldestOpenPayment(studentId: string) {
    return this.prisma.payment.findFirst({
      where: { studentId, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
      select: { id: true },
    });
  }

  // "Fatura atual" = a mais antiga entre as ainda não pagas
  // (PENDING ou OVERDUE) — não filtra por dueDate, porque uma fatura
  // pode estar em aberto tanto por já ter vencido (OVERDUE) quanto
  // por ainda não ter chegado a data de vencimento (PENDING futura).
  // Ordenar por dueDate ASC garante que, se o aluno tiver mais de uma
  // fatura em aberto ao mesmo tempo (ex: o cron já gerou a próxima
  // antes da atual ser paga), a mais urgente/atrasada aparece
  // primeiro, não a futura.
  //
  // Sem studentId: retorna um mapa { studentId: payment | null } com
  // a fatura atual de CADA student vinculado ao usuário — cobre o
  // caso de vários filhos de uma vez. Com studentId: retorna só o
  // objeto de um aluno específico (comportamento antigo, mantido).
  async findMyCurrentPayment(userId: string, studentId?: string) {
    if (studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: studentId, userId },
      });
      if (!student) throw new NotFoundException('Aluno não encontrado');

      return this.prisma.payment.findFirst({
        where: { studentId, status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
      });
    }

    const students = await this.prisma.student.findMany({
      where: { userId },
      select: { id: true, user: { select: { name: true } } },
    });
    if (!students.length) return [];

    const results = await Promise.all(
      students.map(async (student) => {
        const payment = await this.prisma.payment.findFirst({
          where: {
            studentId: student.id,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
        });
        // TODO: trocar student.user.name por student.name assim que a
        // migration de campos próprios do Student (name, birthDate,
        // phone) for aplicada — ver conversa sobre isso
        return {
          studentId: student.id,
          studentName: student.user.name,
          payment,
        };
      }),
    );

    return results;
  }

  // ─── Admin ──────────────────────────────────────────────────

  // payments.service.ts
  async findByStudent(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    return this.prisma.payment.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' },
    });
  }

  async findByMonth(month: string, schoolId: string) {
    const [year, mon] = month.split('-').map(Number) as [number, number];
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    return this.prisma.payment.findMany({
      where: { schoolId, dueDate: { gte: start, lt: end } },
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findPending(schoolId: string) {
    return this.prisma.payment.findMany({
      where: { schoolId, status: { in: ['PENDING', 'OVERDUE'] } },
      include: {
        student: { include: { user: { select: { name: true, phone: true } } } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOne(paymentId: string, schoolId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, schoolId },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    return payment;
  }

  // Gera o link de cobrança no gateway pra uma fatura já existente
  // (chamado automaticamente logo após o Payment ser criado pelo
  // EnrollmentsService, ou sob demanda se o PIX expirar)
  async generateCheckout(paymentId: string, schoolId: string) {
    const payment = await this.findOne(paymentId, schoolId);

    if (payment.status === 'PAID') {
      throw new BadRequestException('Esse pagamento já foi confirmado');
    }

    const charge = await this.provider.createCharge({
      amount: Number(payment.amount),
      // usamos o Payment.id como externalReference — é isso que o
      // gateway devolve de volta no webhook (campo externalId), e é
      // isso que processWebhookEvent usa pra achar a fatura certa
      externalReference: `payment:${payment.id}`,
      description: `Mensalidade ${payment.referenceMonth} - ${payment.student.user.name}`,
      idempotencySalt: String(Date.now()),
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: this.provider.name,
        paymentMethod: 'GATEWAY',
        checkoutUrl: charge.checkoutUrl,
        // externalId aqui guarda o id DA COBRANÇA NO GATEWAY
        // (pix_char_...) — útil pra debug/auditoria e pra chamar
        // /transparents/check manualmente se precisar, mas NÃO é
        // mais usado pra casar o webhook (isso agora é feito por
        // Payment.id, ver processWebhookEvent abaixo)
        externalId: charge.externalId,
        pixCopyPaste: charge.pixCopyPaste,
        pixQrCode: charge.pixQrCode,
      },
    });
  }

  // ─── Fallback manual (admin confirma na mão) ──────────────────
  async confirmManually(
    paymentId: string,
    dto: ConfirmPaymentDto,
    adminUserId: string,
    schoolId: string,
  ) {
    const payment = await this.findOne(paymentId, schoolId);

    if (payment.status === 'PAID') {
      throw new BadRequestException('Esse pagamento já está confirmado');
    }

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod: 'MANUAL_PIX',
        proofUrl: dto.proofUrl,
        confirmedBy: adminUserId,
      },
    });
  }

  // ─── Webhook (fluxo principal — chamado pelo gateway) ─────────
  // Idempotente: se o gateway reenviar o mesmo evento (retry), não
  // processa de novo nem quebra.
  //
  // paymentId aqui é o Payment.id do NOSSO banco — é o valor que
  // mandamos como `externalId` na criação da cobrança
  // (generateCheckout), e que o gateway devolve de volta no webhook.
  // Buscar pela chave primária é mais robusto que buscar pelo id do
  // gateway: não depende de externalId ter sido salvo corretamente
  // antes, e nunca é ambíguo.
  async processWebhookEvent(
    externalReference: string,
    paidAt: Date | undefined,
  ) {
    const [type, id] = externalReference.split(':');

    if (type === 'bundle') {
      return this.processBundleWebhookEvent(id, paidAt);
    }

    if (type === 'payment') {
      return this.processPaymentWebhookEvent(id, paidAt);
    }

    // fallback: cobranças antigas, criadas antes do prefixo existir,
    // mandavam o Payment.id puro — mantém compatibilidade
    return this.processPaymentWebhookEvent(externalReference, paidAt);
  }

  // ─── Webhook (fluxo principal — chamado pelo gateway) ─────────
  private async processPaymentWebhookEvent(
    paymentId: string,
    paidAt: Date | undefined,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return { status: 'ignored', reason: 'payment_not_found' };
    }

    if (payment.status === 'PAID') {
      return { status: 'already_processed' };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAID',
        paidAt: paidAt ?? new Date(),
        webhookReceivedAt: new Date(),
      },
    });

    return { status: 'processed' };
  }

  private async processBundleWebhookEvent(
    bundleId: string,
    paidAt: Date | undefined,
  ) {
    const bundle = await this.prisma.paymentBundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      return { status: 'ignored', reason: 'bundle_not_found' };
    }

    if (bundle.status === 'PAID') {
      return { status: 'already_processed' };
    }

    const resolvedPaidAt = paidAt ?? new Date();

    // ALERTA CRÍTICO: esse bundle foi cancelado no nosso lado (o
    // usuário reformulou a seleção de faturas), mas o PIX antigo dele
    // ainda era válido no gateway e alguém pagou mesmo assim. Isso é
    // dinheiro real que entrou sem fatura correspondente vinculada —
    // NUNCA silenciar isso. Precisa de reconciliação manual: localizar
    // o pagamento na AbacatePay (bundle.externalId) e decidir o que
    // fazer (reembolsar, ou aplicar manualmente em outra fatura do
    // mesmo responsável).
    if (bundle.status === 'CANCELLED') {
      console.error(
        `[ALERTA CRÍTICO] Bundle ${bundleId} estava CANCELLED mas recebeu ` +
          `pagamento via webhook. Valor: R$ ${bundle.amount}. ` +
          `externalId no gateway: ${bundle.externalId}. ` +
          `Responsável (userId): ${bundle.userId}. ` +
          `Isso precisa de reconciliação manual — o dinheiro entrou mas ` +
          `nenhuma fatura será marcada como paga automaticamente.`,
      );

      // ainda marca o bundle como PAID (reflete a realidade: o dinheiro
      // chegou), mas SEM tentar propagar pra faturas — elas já não
      // pertencem mais a esse bundle, e forçar isso poderia marcar como
      // paga uma fatura errada
      await this.prisma.paymentBundle.update({
        where: { id: bundleId },
        data: { status: 'PAID', paidAt: resolvedPaidAt },
      });

      return {
        status: 'processed_with_warning',
        reason: 'paid_after_cancellation_needs_manual_reconciliation',
        bundleId,
      };
    }

    // propaga o pagamento pro bundle E pra todas as faturas cobertas,
    // numa transação — ou tudo fica consistente, ou nada muda
    await this.prisma.$transaction([
      this.prisma.paymentBundle.update({
        where: { id: bundleId },
        data: { status: 'PAID', paidAt: resolvedPaidAt },
      }),
      this.prisma.payment.updateMany({
        where: { paymentBundleId: bundleId },
        data: {
          status: 'PAID',
          paidAt: resolvedPaidAt,
          webhookReceivedAt: new Date(),
        },
      }),
    ]);

    return { status: 'processed', bundleId };
  }

  // ─── Bundle: pagamento agregado de várias faturas ──────────────

  // Recebe os IDs das faturas que o usuário escolheu pagar juntas.
  // Valida que TODAS pertencem a students vinculados a esse userId
  // (pode ser de alunos diferentes, mas sempre do mesmo responsável).
  async createBundle(userId: string, schoolId: string, paymentIds: string[]) {
    if (paymentIds.length < 2) {
      throw new BadRequestException(
        'Um bundle precisa de pelo menos 2 faturas — para uma única fatura, pague ela diretamente',
      );
    }

    // idempotência PRIMEIRO: se já existe um bundle pra exatamente essa
    // seleção (em qualquer ordem), devolve ele em vez de recriar —
    // permite o usuário sair e voltar pra mesma seleção sem duplicar.
    const sortedIds = [...paymentIds].sort();
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(sortedIds.join(','))
      .digest('hex');

    const existingBundle = await this.prisma.paymentBundle.findUnique({
      where: { idempotencyKey },
    });
    if (existingBundle && existingBundle.status !== 'CANCELLED') {
      return existingBundle;
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        id: { in: paymentIds },
        student: { userId },
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: { student: { select: { name: true } } },
    });

    if (payments.length !== paymentIds.length) {
      throw new BadRequestException(
        'Uma ou mais faturas não foram encontradas, não pertencem a você, ou já estão pagas',
      );
    }

    // Faturas presas a bundles antigos: se aquele bundle antigo ainda
    // está PENDING (nunca foi pago), o usuário simplesmente mudou de
    // ideia na seleção — cancelamos o bundle antigo e liberamos as
    // faturas pra essa nova tentativa. Não é conflito real; conflito
    // real seria uma fatura presa a um bundle já PAID, o que não pode
    // acontecer aqui porque só buscamos faturas com status
    // PENDING/OVERDUE acima (fatura de bundle pago já estaria PAID).
    const staleBundleIds = [
      ...new Set(
        payments
          .map((p) => p.paymentBundleId)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (staleBundleIds.length > 0) {
      await this.prisma.$transaction([
        this.prisma.paymentBundle.updateMany({
          where: { id: { in: staleBundleIds }, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        }),
        this.prisma.payment.updateMany({
          where: { paymentBundleId: { in: staleBundleIds } },
          data: { paymentBundleId: null },
        }),
      ]);
    }

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const bundle = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentBundle.upsert({
        where: { idempotencyKey },
        create: {
          schoolId,
          userId,
          amount: totalAmount,
          idempotencyKey,
        },
        update: {
          status: 'PENDING',
          amount: totalAmount,
          paidAt: null,
          externalId: null,
          pixCopyPaste: null,
          pixQrCode: null,
        },
      });

      await tx.payment.updateMany({
        where: { id: { in: paymentIds } },
        data: { paymentBundleId: created.id },
      });

      return created;
    });

    return this.ensureBundleCharge(bundle.id);
  }

  // Detalhe de um bundle específico — só se pertencer ao usuário logado
  async findMyBundleById(bundleId: string, userId: string) {
    const bundle = await this.prisma.paymentBundle.findFirst({
      where: { id: bundleId, userId },
      select: { id: true, status: true },
    });
    if (!bundle)
      throw new NotFoundException('Pagamento agregado não encontrado');

    // só renova PIX se ainda estiver pendente — bundle pago não precisa
    if (bundle.status === 'PENDING') {
      return this.ensureBundleCharge(bundleId);
    }

    return this.prisma.paymentBundle.findFirstOrThrow({
      where: { id: bundleId },
      include: {
        payments: {
          include: { student: { select: { name: true, instrument: true } } },
        },
      },
    });
  }

  private readonly PUNCTUALITY_DISCOUNT = 20;

  // Meia-noite UTC de hoje — MESMA normalização usada em
  // EnrollmentsService.markOverduePayments(). Precisa ser idêntica pra
  // nunca haver um dia em que o cron considera "atrasado" mas o
  // gerador de PIX ainda considera "em dia" (ou vice-versa).
  private todayStartUTC(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  // Decide o valor a cobrar AGORA pra uma fatura — nunca lido do
  // status salvo no banco (que só é atualizado 1x/dia pelo cron e pode
  // estar defasado), sempre comparado direto contra dueDate. Pontual
  // (ainda dentro do prazo) = desconto de pontualidade; atrasado =
  // valor cheio. NÃO altera payment.amount no banco — esse continua
  // sendo sempre o valor cheio da mensalidade, esse cálculo é só pro
  // valor da cobrança PIX gerada agora.
  private calculateChargeAmount(payment: {
    amount: unknown; // Decimal do Prisma
    dueDate: Date;
  }): number {
    const fullAmount = Number(payment.amount);
    const isStillOnTime =
      payment.dueDate.getTime() >= this.todayStartUTC().getTime();
    return isStillOnTime
      ? Math.max(fullAmount - this.PUNCTUALITY_DISCOUNT, 0)
      : fullAmount;
  }

  // Verifica se o PIX de uma fatura/bundle ainda é válido (existe e
  // não expirou). Se não for, gera um novo na hora — é aqui que
  // implementamos "gerar sob demanda" em vez de na criação da fatura.
  private isPixStillValid(
    pixQrCode: string | null,
    pixExpiresAt: Date | null,
  ): boolean {
    if (!pixQrCode || !pixExpiresAt) return false;
    return pixExpiresAt.getTime() > Date.now();
  }

  // Garante que uma fatura tem um PIX válido pra mostrar, gerando um
  // novo na AbacatePay se necessário (nunca gerado, ou expirado).
  // Retorna a fatura atualizada.
  private async ensurePaymentCharge(paymentId: string) {
    const payment = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      include: { student: { include: { user: { select: { name: true } } } } },
    });

    if (this.isPixStillValid(payment.pixQrCode, payment.pixExpiresAt)) {
      return payment;
    }

    const chargeAmount = this.calculateChargeAmount(payment);

    // idempotencySalt = Date.now() garante que essa renovação gera
    // uma chave de idempotência DIFERENTE da tentativa anterior (que
    // expirou), então o Mercado Pago cria um PIX novo de verdade em
    // vez de devolver o antigo já morto. Ver nota completa em
    // mercadopago.provider.ts / payment-provider.interface.ts.
    const charge = await this.provider.createCharge({
      amount: chargeAmount, // ANTES: Number(payment.amount)
      externalReference: `payment:${payment.id}`,
      description: `Mensalidade ${payment.referenceMonth} - ${payment.student.user.name}`,
      expiresInSeconds: this.PIX_EXPIRATION_SECONDS,
      idempotencySalt: String(Date.now()),
    });

    return this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider: this.provider.name,
        paymentMethod: 'GATEWAY',
        externalId: charge.externalId,
        pixCopyPaste: charge.pixCopyPaste,
        pixQrCode: charge.pixQrCode,
        pixExpiresAt: charge.expiresAt ?? null,
        paidAmount: chargeAmount, // NOVO — grava o valor que foi cobrado nesse PIX específico
      },
      include: {
        student: { select: { name: true } },
      },
    });
  }

  // Mesma ideia, mas pra bundle
  private async ensureBundleCharge(bundleId: string) {
    const bundle = await this.prisma.paymentBundle.findUniqueOrThrow({
      where: { id: bundleId },
      include: {
        payments: { include: { student: { select: { name: true } } } },
      },
    });

    if (this.isPixStillValid(bundle.pixQrCode, bundle.pixExpiresAt)) {
      return bundle;
    }

    const studentNames = [
      ...new Set(bundle.payments.map((p) => p.student.name)),
    ].join(', ');

    // Calcula o valor individual de cada fatura E salva em paidAmount —
    // assim o histórico de cada fatura reflete o que ela custou dentro
    // desse bundle, mesmo que a pessoa só veja o "total" na tela do bundle.
    const chargesByPayment = bundle.payments.map((p) => ({
      id: p.id,
      chargeAmount: this.calculateChargeAmount(p),
    }));
    const chargeAmount = chargesByPayment.reduce(
      (sum, c) => sum + c.chargeAmount,
      0,
    );

    const charge = await this.provider.createCharge({
      amount: chargeAmount, // ANTES: Number(bundle.amount)
      externalReference: `bundle:${bundle.id}`,
      description: `Pagamento agregado (${bundle.payments.length} faturas) - ${studentNames}`,
      expiresInSeconds: this.PIX_EXPIRATION_SECONDS,
      idempotencySalt: String(Date.now()),
    });

    await this.prisma.$transaction(
      chargesByPayment.map((c) =>
        this.prisma.payment.update({
          where: { id: c.id },
          data: { paidAmount: c.chargeAmount },
        }),
      ),
    );

    return this.prisma.paymentBundle.update({
      where: { id: bundle.id },
      data: {
        provider: this.provider.name,
        externalId: charge.externalId,
        pixCopyPaste: charge.pixCopyPaste,
        pixQrCode: charge.pixQrCode,
        pixExpiresAt: charge.expiresAt ?? null,
      },
      include: {
        payments: {
          include: { student: { select: { name: true, instrument: true } } },
        },
      },
    });
  }
}
