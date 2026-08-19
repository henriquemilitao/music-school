// backend/src/notifications/payment-reminders.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushMessage, ExpoPushService } from './expo-push.service';

@Injectable()
export class PaymentRemindersService {
  private readonly logger = new Logger(PaymentRemindersService.name);

  // Quantos dias antes do vencimento a janela de aviso abre.
  // 5 = avisa em D-5, D-4, D-3, D-2, D-1 e D-0 (hoje é o último dia).
  private readonly REMINDER_WINDOW_DAYS = 5;

  constructor(
    private prisma: PrismaService,
    private expoPush: ExpoPushService,
  ) {}

  // Roda todo dia às 9h (horário do servidor — ver nota sobre timeZone
  // se o deploy não estiver em horário de Brasília).
  @Cron('0 0 9 * * *')
  async sendDailyPaymentReminders() {
    this.logger.log('Iniciando varredura diária de faturas em aberto...');

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Fim da janela de aviso: hoje + REMINDER_WINDOW_DAYS, até o
    // último milissegundo do dia (pra pegar a fatura inteira daquele
    // dia, não só até meia-noite).
    const windowEnd = new Date(startOfToday);
    windowEnd.setDate(windowEnd.getDate() + this.REMINDER_WINDOW_DAYS);
    windowEnd.setHours(23, 59, 59, 999);

    // PENDING dentro da janela (D-5 até D-0) + qualquer OVERDUE.
    // PENDING fora da janela (vencendo daqui a mais de 5 dias) fica
    // de fora de propósito — ainda não é hora de avisar.
    const openPayments = await this.prisma.payment.findMany({
      where: {
        OR: [
          { status: 'OVERDUE' },
          {
            status: 'PENDING',
            dueDate: { gte: startOfToday, lte: windowEnd },
          },
        ],
      },
      select: {
        id: true,
        amount: true,
        status: true,
        dueDate: true,
        student: {
          select: {
            userId: true,
            user: { select: { pushToken: true } },
          },
        },
      },
    });

    if (openPayments.length === 0) {
      this.logger.log('Nenhuma fatura na janela de aviso hoje.');
      return;
    }

    // Agrupa por usuário — um responsável com 2 filhos com fatura
    // aberta recebe UM push resumido, não dois separados. Guardamos
    // o menor daysUntilDue do lote (a fatura mais urgente) só pra
    // decidir o tom da mensagem quando não há OVERDUE nenhuma.
    const byUser = new Map<
      string,
      {
        pushToken: string | null;
        overdueCount: number;
        pendingCount: number;
        minDaysUntilDue: number | null;
      }
    >();

    for (const payment of openPayments) {
      const userId = payment.student.userId;
      const pushToken = payment.student.user.pushToken;

      if (!byUser.has(userId)) {
        byUser.set(userId, {
          pushToken,
          overdueCount: 0,
          pendingCount: 0,
          minDaysUntilDue: null,
        });
      }
      const entry = byUser.get(userId)!;

      if (payment.status === 'OVERDUE') {
        entry.overdueCount++;
      } else {
        entry.pendingCount++;
        const days = this.daysUntil(payment.dueDate, startOfToday);
        if (entry.minDaysUntilDue === null || days < entry.minDaysUntilDue) {
          entry.minDaysUntilDue = days;
        }
      }
    }

    const messages: ExpoPushMessage[] = [];

    for (const [
      userId,
      { pushToken, overdueCount, pendingCount, minDaysUntilDue },
    ] of byUser) {
      if (!pushToken) {
        this.logger.debug(
          `Usuário ${userId} tem fatura em aberto mas sem pushToken registrado — pulando`,
        );
        continue;
      }

      const totalOpen = overdueCount + pendingCount;
      const { title, body } = this.buildMessage(
        overdueCount,
        pendingCount,
        minDaysUntilDue,
      );

      messages.push({
        to: pushToken,
        title,
        body,
        badge: totalOpen, // número vermelho no ícone do app
        data: { type: 'PAYMENT_REMINDER' },
        sound: 'default' as const,
      });
    }

    await this.expoPush.sendBatch(messages);
    this.logger.log(
      `Envio concluído: ${messages.length} push(es) disparado(s) de ${byUser.size} usuário(s) com fatura em aberto.`,
    );
  }

  // Quantos dias faltam até o vencimento, contados em dias de
  // calendário (não em horas) — por isso zeramos a hora de ambas as
  // datas antes de subtrair.
  private daysUntil(dueDate: Date, startOfToday: Date): number {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffMs = due.getTime() - startOfToday.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  private buildMessage(
    overdueCount: number,
    pendingCount: number,
    minDaysUntilDue: number | null,
  ) {
    // Existe pelo menos 1 fatura atrasada — prioriza esse tom, mesmo
    // que também tenha uma pendente dentro da janela. Na prática, se
    // o usuário chegou a acumular fatura aberta E atrasada é porque o
    // ciclo de renovação já gerou a próxima antes dele quitar a
    // anterior — não vale a pena detalhar prazo de cada uma aqui,
    // só a contagem total.
    if (overdueCount > 0) {
      const totalOpen = overdueCount + pendingCount;
      return {
        title: '😭 Fatura atrasada',
        body:
          totalOpen === 1
            ? 'Você tem 1 fatura atrasada. Toque para regularizar.'
            : `Você tem ${totalOpen} faturas em aberto (algumas atrasadas). Toque para regularizar.`,
      };
    }

    // Só PENDING dentro da janela — minDaysUntilDue nunca é null aqui,
    // já que só entramos nesse ramo se pendingCount > 0.
    const days = minDaysUntilDue ?? 0;

    if (pendingCount > 1) {
      // 2+ faturas pendentes na janela ao mesmo tempo (multi-aluno) —
      // usa o prazo mais urgente entre elas pro tom da mensagem.
      const prazo = days === 0 ? 'vence hoje' : `vence em ${days} dia(s)`;
      return {
        title: 'Faturas a vencer',
        body: `Você tem ${pendingCount} faturas em aberto — a mais próxima ${prazo}. Toque para ver.`,
      };
    }

    // Exatamente 1 fatura pendente na janela — mensagem dia a dia.
    if (days === 0) {
      return {
        title: '👀 Hoje é o último dia',
        body: 'Sua fatura vence hoje. Toque para pagar.',
      };
    }

    return {
      title:
        days === 1 ? 'Fatura vence amanhã' : `Fatura vence em ${days} dias`,
      body:
        days === 1
          ? 'Sua fatura vence amanhã. Toque para pagar.'
          : `Sua fatura vence em ${days} dias. Toque para pagar.`,
    };
  }
}
