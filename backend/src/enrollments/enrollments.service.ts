// backend/src/enrollments/enrollments.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { Enrollment } from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────────────────────────────────────────
  // CRIAÇÃO — chamado quando o admin cadastra uma matrícula nova
  // (seja direto via POST /enrollments, seja dentro do fluxo
  // "canhão" createFull do UsersService).
  // ───────────────────────────────────────────────────────────
  async create(dto: CreateEnrollmentDto, schoolId: string) {
    // Confere que o aluno existe E pertence à escola de quem está
    // criando (evita um admin de uma escola matricular aluno de outra
    // escola só adivinhando o UUID).
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    // Mesma checagem de posse, só que pro professor (só valida se um
    // teacherId foi de fato enviado, já que é campo opcional).
    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, user: { schoolId } },
      });
      if (!teacher) throw new NotFoundException('Professor não encontrado');
    }

    // NOVO — busca o offset de fuso configurado pra essa escola.
    // Precisamos disso ANTES de montar qualquer data, porque tanto
    // o horário das aulas quanto o vencimento da fatura dependem
    // desse valor pra saberem em que "hora UTC real" ficam gravados.
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { timezoneOffsetHours: true },
    });

    // Converte a string ISO recebida do DTO (ex: "2026-09-15") pra
    // um objeto Date de verdade, que é o que o Prisma e os cálculos
    // de data internos esperam.
    const firstLessonDate = new Date(dto.firstLessonDate);

    // ── Default do vencimento ──────────────────────────────────
    const rawFirstPaymentDueDate = dto.firstPaymentDueDate
      ? new Date(dto.firstPaymentDueDate)
      : firstLessonDate;

    // NOVO — normaliza pro meio-dia UTC, mesmo motivo do
    // getNextMonthlyDateAtNoon: evita que o PRIMEIRO vencimento de
    // toda matrícula nasça à meia-noite (que "escorrega" 1 dia pra
    // trás em qualquer fuso negativo, como todo o Brasil). Sem isso,
    // só os vencimentos gerados pelo CRON (renovações) ficariam
    // corretos — o primeiro, criado junto com a matrícula, ficaria
    // com o mesmo bug de antes.
    const firstPaymentDueDate = this.toNoonUTC(rawFirstPaymentDueDate);

    const enrollment = await this.prisma.enrollment.create({
      data: {
        schoolId,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        weekDay: firstLessonDate.getUTCDay(),
        startTime: dto.startTime,
        durationMinutes: dto.durationMinutes ?? 60,
        monthlyAmount: dto.monthlyAmount,
        firstLessonDate,
        firstPaymentDueDate, // agora já vem normalizado ao meio-dia
      },
    });

    await this.generatePeriod({
      enrollmentId: enrollment.id,
      lessonPeriodStart: firstLessonDate,
      paymentDueDate: firstPaymentDueDate, // já normalizado
      referenceMonth:
        dto.referenceMonth ?? this.toMonthKey(firstPaymentDueDate),
      markAsPaid: dto.firstPaymentPaid ?? false,
      timezoneOffsetHours: school.timezoneOffsetHours,
    });

    return this.findOne(enrollment.id, schoolId);
  }

  // ───────────────────────────────────────────────────────────
  // RENOVAÇÃO MANUAL — endpoint que um admin pode chamar na mão
  // pra forçar a geração do próximo mês antes da hora (o cron
  // normalmente faz isso sozinho, isso aqui é um "forçar agora").
  // ───────────────────────────────────────────────────────────
  async renew(enrollmentId: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId },
    });

    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    if (!enrollment.isActive) {
      throw new BadRequestException(
        'Matrícula encerrada — não é possível renovar',
      );
    }

    // NOVO — busca o offset também aqui, mesmo motivo do create()
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { timezoneOffsetHours: true },
    });

    // Calcula onde cada "relógio" deveria estar no PRÓXIMO ciclo,
    // cada um seguindo seu próprio dia-âncora independente.
    const nextLessonPeriodStart = this.getNextLessonPeriodStart(enrollment);
    const nextPaymentDueDate = this.getNextPaymentDueDate(
      enrollment,
      school.timezoneOffsetHours, // NOVO parâmetro
    );
    const nextPeriodKey = this.toPeriodKey(nextLessonPeriodStart);

    // Trava de idempotência: se o período de aulas que estamos
    // prestes a gerar já foi gerado antes (comparando o rótulo em
    // texto), rejeita — evita duplicar aulas/fatura por engano.
    if (enrollment.lastGeneratedPeriodKey === nextPeriodKey) {
      throw new BadRequestException(`Período ${nextPeriodKey} já foi gerado`);
    }

    await this.generatePeriod({
      enrollmentId,
      lessonPeriodStart: nextLessonPeriodStart,
      paymentDueDate: nextPaymentDueDate,
      // Renovação nunca recebe referenceMonth manual (não tem DTO
      // aqui) — sempre calculado a partir do mês do vencimento,
      // mesma regra de default da criação.
      referenceMonth: this.toMonthKey(nextPaymentDueDate),
      markAsPaid: false, // renovação nunca marca como já paga
      timezoneOffsetHours: school.timezoneOffsetHours, // NOVO
    });

    return this.findOne(enrollmentId, schoolId);
  }

  // ───────────────────────────────────────────────────────────
  // ENCERRAR MATRÍCULA — o cron nunca mais vai renovar essa
  // matrícula depois disso (ver renewDueSoon, que só busca
  // isActive: true).
  // ───────────────────────────────────────────────────────────
  async deactivate(enrollmentId: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { isActive: false },
    });
  }

  // ─── Consultas simples (sem lógica de data — mantidas como estavam) ───

  async findAllBySchool(schoolId: string) {
    return this.prisma.enrollment.findMany({
      where: { schoolId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            instrument: true,
            user: { select: { name: true, email: true } },
          },
        },
        teacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(enrollmentId: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            instrument: true,
            user: { select: { name: true, email: true } },
          },
        },
        teacher: { include: { user: { select: { name: true } } } },
        payments: { orderBy: { referenceMonth: 'desc' }, take: 3 },
        lessons: {
          where: { status: 'SCHEDULED' },
          orderBy: { scheduledAt: 'asc' },
          take: 5,
        },
      },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return enrollment;
  }

  async findByStudent(studentId: string, schoolId: string) {
    return this.prisma.enrollment.findFirst({
      where: { studentId, schoolId, isActive: true },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });
  }

  // ───────────────────────────────────────────────────────────
  // CRON 1 — roda todo dia (ver EnrollmentRenewalCron). Verifica
  // TODAS as matrículas ativas e gera o próximo ciclo (aulas +
  // fatura) pra quem estiver a `daysBeforeStart` dias ou menos do
  // próximo VENCIMENTO (não do próximo início de aula — o gatilho
  // do cron é sempre o relógio de pagamento, por ser o que importa
  // financeiramente pro admin cobrar com antecedência).
  // ───────────────────────────────────────────────────────────
  async renewDueSoon(daysBeforeStart: number = 10) {
    // NOVO — busca TODAS as escolas de uma vez, num Map, pra não
    // fazer 1 query de School por matrícula dentro do loop (seria
    // ineficiente se houver muitas matrículas de escolas diferentes)
    const schools = await this.prisma.school.findMany({
      select: { id: true, timezoneOffsetHours: true },
    });
    const timezoneBySchoolId = new Map(
      schools.map((s) => [s.id, s.timezoneOffsetHours]),
    );

    // Busca só matrículas ativas — as encerradas (isActive: false)
    // nunca são candidatas a renovação automática.
    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: { isActive: true },
    });

    // Acumula um registro do que foi gerado nessa execução, pra
    // devolver como resultado (usado hoje só em log — ver
    // EnrollmentRenewalCron.handleRenewal).
    const results: { enrollmentId: string; generated: string }[] = [];

    // Processa cada matrícula individualmente, dentro de um
    // try/catch por item — assim, se uma matrícula específica der
    // erro (ex: dado corrompido), as outras continuam sendo
    // processadas normalmente em vez do cron inteiro falhar.
    for (const enrollment of activeEnrollments) {
      try {
        // NOVO — pega o offset da escola dona dessa matrícula
        // específica (fallback -4 só por segurança, não deveria
        // nunca cair nesse caso já que toda matrícula tem schoolId
        // válido por causa da foreign key)
        const timezoneOffsetHours =
          timezoneBySchoolId.get(enrollment.schoolId) ?? -4;

        const nextLessonPeriodStart = this.getNextLessonPeriodStart(enrollment);
        const nextPaymentDueDate = this.getNextPaymentDueDate(
          enrollment,
          timezoneOffsetHours, // NOVO
        );
        const nextPeriodKey = this.toPeriodKey(nextLessonPeriodStart);

        // Já gerou esse período antes? Pula pra próxima matrícula.
        if (enrollment.lastGeneratedPeriodKey === nextPeriodKey) continue;

        // Quantos dias faltam a partir de AGORA até o PRÓXIMO
        // vencimento (nextPaymentDueDate) — é essa distância que
        // decide se já é hora de gerar o próximo ciclo ou não.
        // Math.ceil arredonda pra cima: mesmo faltando 9h30 pro
        // vencimento, considera como "1 dia restante" em vez de "0",
        // evitando que o cron pule o disparo por causa de horário.
        const daysRemaining = Math.ceil(
          (nextPaymentDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        // Só gera se estiver dentro da janela configurada (padrão:
        // 10 dias ou menos até vencer).
        if (daysRemaining <= daysBeforeStart) {
          await this.generatePeriod({
            enrollmentId: enrollment.id,
            lessonPeriodStart: nextLessonPeriodStart,
            paymentDueDate: nextPaymentDueDate,
            referenceMonth: this.toMonthKey(nextPaymentDueDate),
            markAsPaid: false,
            timezoneOffsetHours, // NOVO
          });
          results.push({
            enrollmentId: enrollment.id,
            generated: nextPeriodKey,
          });
        }
      } catch (err) {
        // Loga o erro mas não interrompe o loop — uma matrícula com
        // problema não pode travar a renovação de todas as outras.
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `Erro ao gerar período pra matrícula ${enrollment.id}:`,
          message,
        );
        continue;
      }
    }

    return results;
  }

  // ───────────────────────────────────────────────────────────
  // CRON 2 — marca como OVERDUE toda fatura PENDING cuja dueDate
  // já passou (atraso = 1 dia após a dueDate). Não mexe em nada
  // relacionado a aulas, só no status financeiro do Payment.
  // ───────────────────────────────────────────────────────────
  async markOverduePayments() {
    const now = new Date();
    // Constrói meia-noite UTC de hoje — usamos UTC porque dueDate
    // também é sempre salva em UTC meia-noite, então comparar
    // "meia-noite UTC" com "meia-noite UTC" evita erro de 1 dia que
    // aconteceria se misturássemos fuso horário local do servidor
    // com UTC do banco.
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // updateMany: atualiza em massa TODAS as faturas PENDING cuja
    // dueDate é estritamente menor que hoje (ou seja, já venceram
    // ontem ou antes) — não mexe em faturas que vencem hoje mesmo,
    // essas continuam PENDING até amanhã.
    const result = await this.prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: todayStart },
      },
      data: { status: 'OVERDUE' },
    });

    return { updatedCount: result.count };
  }

  // ═══════════════════════════════════════════════════════════
  // Helpers privados — a "engenharia" por trás dos dois relógios
  // ═══════════════════════════════════════════════════════════

  // ───────────────────────────────────────────────────────────
  // generatePeriod: função central que realmente CRIA as aulas e a
  // fatura de um ciclo (seja o primeiro, na criação, seja um
  // seguinte, via renew() ou renewDueSoon()). Recebe um objeto (em
  // vez de vários parâmetros soltos) pra deixar explícito, em cada
  // chamada, qual data é qual — evita o erro comum de trocar a
  // ordem de dois parâmetros Date que são visualmente idênticos.
  // ───────────────────────────────────────────────────────────
  private async generatePeriod(params: {
    enrollmentId: string;
    lessonPeriodStart: Date; // início do ciclo de AULAS deste período
    paymentDueDate: Date; // vencimento da FATURA deste período
    referenceMonth: string; // rótulo do mês desta fatura, ex: "2026-09"
    markAsPaid: boolean; // true só quando o admin já confirma pagamento na criação
    timezoneOffsetHours: number; // NOVO parâmetro
  }) {
    const {
      enrollmentId,
      lessonPeriodStart,
      paymentDueDate,
      referenceMonth,
      markAsPaid,
      timezoneOffsetHours, // NOVO
    } = params;

    // Busca a matrícula completa — precisamos dela pra saber
    // weekDay, startTime, durationMinutes, frequency e
    // firstLessonDate (usado como âncora dentro de buildLessonsForPeriod).
    const enrollment = await this.prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
    });

    // Rótulo em texto do início do ciclo de AULAS (não do
    // vencimento!) — esse é o valor usado tanto na idempotencyKey
    // quanto no controle interno lastGeneratedPeriodKey. Manter isso
    // sempre baseado no ciclo de aulas (e não no vencimento) garante
    // que "gerar o período de aulas de novo" e "gerar a fatura de
    // novo" sejam sempre a MESMA operação atômica, nunca destalinhada.
    const periodKey = this.toPeriodKey(lessonPeriodStart);

    // Monta a lista de datas/horários de cada aula desse ciclo.
    // NOVO — repassa o offset pra buildLessonsForPeriod poder montar
    // a hora de cada aula convertida corretamente
    const lessons = this.buildLessonsForPeriod(
      enrollment,
      lessonPeriodStart,
      timezoneOffsetHours,
    );
    // Chave de idempotência do Payment: combina aluno + período de
    // aulas. Isso é o que impede, no upsert abaixo, que uma fatura
    // duplicada seja criada se generatePeriod for chamado duas vezes
    // pro mesmo período (ex: cron rodando 2x por engano).
    const idempotencyKey = `${enrollment.studentId}-${periodKey}`;

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // Decide o status inicial da fatura: PAID se o admin já
    // confirmou pagamento manual; senão, OVERDUE se o vencimento já
    // é passado (caso raro, mas possível se o admin cadastrar uma
    // matrícula retroativa); senão, PENDING (caso normal).
    const initialStatus = markAsPaid
      ? 'PAID'
      : paymentDueDate < todayStart
        ? 'OVERDUE'
        : 'PENDING';

    // Transação: cria as aulas, cria/reaproveita a fatura, e
    // atualiza a memória interna da matrícula — tudo isso precisa
    // acontecer junto (ou tudo funciona, ou nada é salvo), senão
    // corremos risco de ter aulas criadas sem fatura correspondente,
    // ou vice-versa.
    const [, payment] = await this.prisma.$transaction([
      // createMany das aulas — skipDuplicates evita erro caso, por
      // algum motivo, uma aula com os mesmos dados já exista (não
      // deveria acontecer no fluxo normal, mas é uma proteção barata).
      this.prisma.lesson.createMany({
        data: lessons.map((scheduledAt) => ({
          schoolId: enrollment.schoolId,
          studentId: enrollment.studentId,
          teacherId: enrollment.teacherId ?? null,
          enrollmentId: enrollment.id,
          scheduledAt,
          durationMinutes: enrollment.durationMinutes,
          status: 'SCHEDULED' as const,
        })),
        skipDuplicates: true,
      }),

      // upsert do Payment: se já existe uma fatura com essa
      // idempotencyKey, não faz nada (update vazio); se não existe,
      // cria do zero. Isso é o que torna generatePeriod seguro de
      // ser chamado mais de uma vez pro mesmo período sem duplicar
      // cobrança.
      this.prisma.payment.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          schoolId: enrollment.schoolId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          amount: enrollment.monthlyAmount,
          dueDate: paymentDueDate, // vencimento do RELÓGIO de pagamento, não do de aulas
          status: initialStatus,
          paidAt: markAsPaid ? new Date() : null,
          paymentMethod: markAsPaid ? 'MANUAL_PIX' : 'GATEWAY',
          referenceMonth,
          idempotencyKey,
        },
      }),

      // Atualiza a "memória" da matrícula: registra que esse foi o
      // último ciclo de aulas gerado (lastLessonPeriodStart +
      // lastGeneratedPeriodKey) E o último vencimento gerado
      // (lastPaymentDueDate) — os dois relógios avançam juntos aqui,
      // já que generatePeriod sempre gera os dois de uma vez.
      this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          lastGeneratedPeriodKey: periodKey,
          lastLessonPeriodStart: lessonPeriodStart,
          lastPaymentDueDate: paymentDueDate,
        },
      }),
    ]);

    return payment;
  }

  // ───────────────────────────────────────────────────────────
  // buildLessonsForPeriod: gera a lista de horários de TODAS as
  // aulas de um ciclo mensal (do início do ciclo até o início do
  // ciclo seguinte, sem incluir esse último).
  // ───────────────────────────────────────────────────────────

  private buildLessonsForPeriod(
    enrollment: Pick<
      Enrollment,
      | 'weekDay'
      | 'startTime'
      | 'durationMinutes'
      | 'frequency'
      | 'firstLessonDate'
    >,
    periodStart: Date,
    timezoneOffsetHours: number, // NOVO parâmetro
  ): Date[] {
    // Quebra "15:00" em hours=15, minutes=00 — usado abaixo pra
    // montar o horário exato de cada aula gerada.
    const [hours, minutes] = enrollment.startTime.split(':').map(Number) as [
      number,
      number,
    ];

    // O "dia âncora" do ciclo de AULAS é sempre extraído de
    // firstLessonDate — NUNCA do período atual (periodStart) — pelo
    // mesmo motivo explicado em getNextLessonPeriodStart: usar o dia
    // do último período geraria o bug de "ficar preso" em fevereiro
    // (dia 28) pra sempre, mesmo quando o mês seguinte tem 30/31 dias.
    const anchorDay = enrollment.firstLessonDate.getUTCDate();

    // periodEnd = início do PRÓXIMO ciclo mensal — é o limite (não
    // incluso) de onde as aulas deste período vão até.
    const periodEnd = this.getNextMonthlyDate(anchorDay, periodStart, 1);

    // Array que vai acumular cada data de aula encontrada dentro do
    // intervalo [periodStart, periodEnd).
    const dates: Date[] = [];

    // cursor: ponteiro que "caminha" dia a dia dentro do período,
    // começando exatamente na meia-noite UTC do dia de periodStart
    // (zera hora/minuto pra não carregar nenhum horário residual).
    const cursor = new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        periodStart.getUTCDate(),
      ),
    );

    // Percorre dia a dia enquanto o cursor não alcançar o fim do
    // período — a cada dia, checa se o dia da semana bate com o
    // weekDay configurado na matrícula; se bater, monta a data
    // completa (com hora/minuto da aula) e adiciona no array.
    while (cursor < periodEnd) {
      if (cursor.getUTCDay() === enrollment.weekDay) {
        dates.push(
          new Date(
            Date.UTC(
              cursor.getUTCFullYear(),
              cursor.getUTCMonth(),
              cursor.getUTCDate(),
              // NOVO — converte a hora LOCAL digitada (ex: 8, de
              // "08:00") pra hora UTC real, subtraindo o offset
              // (negativo) da escola. Ex: timezoneOffsetHours=-4,
              // hours=8 → 8 - (-4) = 12 → grava 12h UTC, que
              // corresponde a 8h em Campo Grande.
              hours - timezoneOffsetHours,
              minutes,
              0,
              0,
            ),
          ),
        );
      }
      // Avança o cursor em 1 dia — setUTCDate lida sozinho com
      // virada de mês (ex: dia 31 + 1 vira dia 1 do mês seguinte).
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // BIWEEKLY existe no enum do schema mas está fora de uso no MVP
    // (não exposto no DTO) — se algum registro antigo tiver essa
    // frequency, filtra pra pegar só índices pares (uma aula sim,
    // uma não). Aviso: essa lógica NÃO garante 15 dias reais de
    // intervalo, é só um filtro simplificado.
    if (enrollment.frequency === 'BIWEEKLY') {
      return dates.filter((_, index) => index % 2 === 0);
    }

    return dates;
  }

  // ───────────────────────────────────────────────────────────
  // getNextLessonPeriodStart: calcula quando começa o PRÓXIMO ciclo
  // de AULAS — relógio independente do vencimento.
  // ───────────────────────────────────────────────────────────
  private getNextLessonPeriodStart(
    enrollment: Pick<Enrollment, 'lastLessonPeriodStart' | 'firstLessonDate'>,
  ): Date {
    // Se essa matrícula nunca gerou nenhum ciclo ainda (recém criada,
    // generatePeriod ainda não rodou), o "próximo" ciclo é o próprio
    // primeiro ciclo — devolve firstLessonDate.
    if (!enrollment.lastLessonPeriodStart) {
      return new Date(enrollment.firstLessonDate);
    }
    // Já gerou pelo menos um ciclo antes: o dia-âncora usado é
    // SEMPRE o de firstLessonDate (nunca de lastLessonPeriodStart) —
    // ver a explicação detalhada do "bug de fevereiro" no comentário
    // de getNextMonthlyDate mais abaixo.
    const anchorDay = enrollment.firstLessonDate.getUTCDate();
    // Soma 1 mês a partir de onde paramos da última vez.
    return this.getNextMonthlyDate(
      anchorDay,
      enrollment.lastLessonPeriodStart,
      1,
    );
  }

  // ───────────────────────────────────────────────────────────
  // getNextPaymentDueDate: calcula quando é o PRÓXIMO vencimento —
  // relógio irmão do de cima, mesma lógica, mas ancorado em
  // firstPaymentDueDate/lastPaymentDueDate em vez de
  // firstLessonDate/lastLessonPeriodStart. Os dois nunca se misturam.
  // ───────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────
  // getNextPaymentDueDate — agora recebe o offset também, pra poder
  // forçar a hora do meio-dia (ver getNextMonthlyDate abaixo)
  // ───────────────────────────────────────────────────────────
  private getNextPaymentDueDate(
    enrollment: Pick<Enrollment, 'lastPaymentDueDate' | 'firstPaymentDueDate'>,
    timezoneOffsetHours: number, // NOVO parâmetro (não usado diretamente
    // aqui, mas repassado pra manter a assinatura consistente caso
    // getNextMonthlyDate precise dele no futuro — hoje o vencimento
    // usa hora fixa 12h UTC, não depende do fuso da escola)
  ): Date {
    if (!enrollment.lastPaymentDueDate) {
      return this.toNoonUTC(enrollment.firstPaymentDueDate);
    }
    const anchorDay = enrollment.firstPaymentDueDate.getUTCDate();
    return this.getNextMonthlyDateAtNoon(
      anchorDay,
      enrollment.lastPaymentDueDate,
      1,
    );
  }

  /**
   * getNextMonthlyDate: função matemática pura, compartilhada pelos
   * dois relógios acima — calcula "daqui a X meses, em que dia cai,
   * mantendo o dia-âncora fixo (com ajuste automático se o mês de
   * destino não tiver esse dia — ex: âncora 31 caindo em fevereiro
   * vira dia 28/29)".
   *
   * @param anchorDay - o dia do mês (1-31) que queremos manter fixo.
   *   IMPORTANTE: deve vir sempre do campo ORIGINAL da matrícula
   *   (firstLessonDate ou firstPaymentDueDate), nunca de uma data já
   *   "ajustada" por essa mesma função — porque se usássemos o dia
   *   de um período que já sofreu ajuste (ex: caiu em fev/28), o
   *   próximo cálculo ficaria "preso" no 28 pra sempre, mesmo em
   *   meses com 30/31 dias. Usando sempre o dia original, o ciclo
   *   volta pro dia certo assim que o mês seguinte permitir.
   * @param referenceDate - a partir de que mês/ano contar os
   *   monthsToAdd (normalmente, o último período/vencimento gerado).
   * @param monthsToAdd - quantos meses somar a partir de referenceDate.
   */

  // ───────────────────────────────────────────────────────────
  // getNextMonthlyDate — usado só pro ciclo de AULAS (mantém a hora
  // em zero, já que quem decide a hora final é buildLessonsForPeriod)
  // ───────────────────────────────────────────────────────────
  private getNextMonthlyDate(
    anchorDay: number,
    referenceDate: Date,
    monthsToAdd: number,
  ): Date {
    const targetYear = referenceDate.getUTCFullYear();
    // getUTCMonth() é 0-indexado (0=janeiro), então somamos
    // monthsToAdd direto nele — o JS já sabe "estourar" pro ano
    // seguinte sozinho se o resultado passar de 11 (dezembro).
    const targetMonth = referenceDate.getUTCMonth() + monthsToAdd;

    // Truque clássico: "dia 0 do mês seguinte ao de destino" É o
    // último dia do mês de destino. Isso descobre quantos dias tem
    // aquele mês (28, 29, 30 ou 31) sem precisar de tabela nem checar
    // ano bissexto manualmente — o Date do JS já resolve isso sozinho.
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();

    // Se o dia-âncora (ex: 31) não existir no mês de destino (ex:
    // fevereiro só tem 28/29), usa o último dia válido daquele mês
    // em vez de "estourar" pro mês seguinte.
    const finalDay = Math.min(anchorDay, lastDayOfTargetMonth);

    return new Date(Date.UTC(targetYear, targetMonth, finalDay));
  }

  // ───────────────────────────────────────────────────────────
  // NOVO — mesma lógica de getNextMonthlyDate, mas força a hora
  // pra 12h UTC. Usado exclusivamente pro ciclo de VENCIMENTO, pra
  // que a data nunca fique perto da virada de dia em nenhum fuso
  // razoável (evita o bug de "vence dia 7" aparecer como "dia 6" em
  // qualquer fuso negativo, como todo o Brasil).
  // ───────────────────────────────────────────────────────────
  private getNextMonthlyDateAtNoon(
    anchorDay: number,
    referenceDate: Date,
    monthsToAdd: number,
  ): Date {
    const targetYear = referenceDate.getUTCFullYear();
    const targetMonth = referenceDate.getUTCMonth() + monthsToAdd;
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();
    const finalDay = Math.min(anchorDay, lastDayOfTargetMonth);
    // 12 no quinto argumento = hora fixa meio-dia UTC
    return new Date(Date.UTC(targetYear, targetMonth, finalDay, 12, 0, 0, 0));
  }

  // ───────────────────────────────────────────────────────────
  // NOVO — normaliza uma data qualquer pra meio-dia UTC do MESMO
  // dia (usado só na primeira geração, quando firstPaymentDueDate
  // vem "cru" do DTO, possivelmente à meia-noite).
  // ───────────────────────────────────────────────────────────
  private toNoonUTC(date: Date): Date {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        12,
        0,
        0,
        0,
      ),
    );
  }

  // ───────────────────────────────────────────────────────────
  // toPeriodKey: rótulo em texto ("2026-09-15") de uma data — usado
  // só como identificador legível/chave, nunca em cálculo de datas.
  // Formato dia+mês+ano completo (não só "YYYY-MM") garante que dois
  // ciclos diferentes nunca colidem, mesmo caindo no mesmo mês civil
  // (ex: um ciclo de aulas que começa dia 5 e outro que começa dia
  // 20, ambos em setembro, geram chaves diferentes: "2026-09-05" e
  // "2026-09-20").
  // ───────────────────────────────────────────────────────────

  private toPeriodKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ───────────────────────────────────────────────────────────
  // toMonthKey: rótulo em texto SÓ do mês ("2026-09") de uma data —
  // usado especificamente pra calcular o referenceMonth PADRÃO da
  // fatura, quando o admin não informa um manualmente. Diferente de
  // toPeriodKey (que inclui o dia), esse aqui existe só pra bater
  // com o formato esperado no campo Payment.referenceMonth ("YYYY-MM").
  // ───────────────────────────────────────────────────────────

  private toMonthKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
}
