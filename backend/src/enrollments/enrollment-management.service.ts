// backend/src/enrollments/enrollment-management.service.ts
//
// Edição e encerramento de matrículas já existentes. Separado do
// EnrollmentsService (que cuida da GERAÇÃO de aulas/faturas) pra manter cada
// arquivo com uma responsabilidade só.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Enrollment, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from './enrollments.service';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { SchedulePreviewQueryDto } from './dto/schedule-preview-query.dto';
import { EndMode } from './dto/end-enrollment.dto';
import {
  addMonthsKeepingAnchor,
  dateWithAnchorDay,
  moveLessonToSchedule,
  periodStartFromKey,
  toLocalDay,
} from './enrollment-schedule.util';

export interface ScheduleChangeItem {
  lessonId: string;
  from: Date;
  to: Date;
  fromDurationMinutes: number;
  durationMinutes: number; // duração nova
}

// Motivo gravado nas aulas canceladas pelo encerramento da matrícula
export const ENROLLMENT_ENDED_CANCEL_REASON = 'Matrícula encerrada';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Quantas faturas (as mais recentes) a tela mostra para decidir
const RECENT_PAYMENTS_LIMIT = 3;

export type PaymentSuggestion = 'KEEP' | 'DELETE';

export interface EndInput {
  mode: EndMode;
  fromLessonId?: string;
  afterPaymentId?: string;
  deletePaymentIds?: string[];
}

// Fatura com o período de aulas que ela cobre (datas "AAAA-MM-DD")
export interface InvoiceOption {
  id: string;
  referenceMonth: string;
  amount: string;
  dueDate: Date;
  status: string;
  periodStart: string | null;
  periodLastDay: string | null;
}

// Fatura sobre a qual o encerramento age
export interface EndPaymentOption extends InvoiceOption {
  // Aulas do ciclo desta fatura que serão canceladas agora
  lessonsCancelled: number;
  // Aulas do ciclo que continuam valendo (já dadas ou antes do corte)
  lessonsRemaining: number;
  // Sugestão: apagar só quando não sobra nenhuma aula no ciclo
  suggestion: PaymentSuggestion;
  // true = será apagada sem escolha (fatura depois da escolhida)
  locked: boolean;
}

interface EndPaymentCandidate extends EndPaymentOption {
  bundleId: string | null;
  bundleStatus: string | null;
}

interface EndTarget {
  cutoff: Date;
  afterPayment?: { id: string; periodStart: Date };
}

export interface EndPlan {
  mode: EndMode;
  cutoff: Date;
  // Quando a matrícula deixa de estar ativa. null = imediatamente (não
  // sobra nenhuma aula futura). Data = segue ativa até o fim da última
  // aula que continua valendo; um cron marca isActive=false depois.
  endsAt: Date | null;
  lessonIds: string[]; // aulas agendadas a partir do corte → canceladas
  lessonsKept: number;
  payments: EndPaymentCandidate[];
  olderPaymentsCount: number;
}

@Injectable()
export class EnrollmentManagementService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  // ─── Consultas de apoio pras telas ────────────────────────────────

  // Aulas agendadas daqui pra frente — a tela usa pra o admin escolher "a
  // partir de qual aula" (troca de horário ou encerramento).
  async listUpcomingLessons(enrollmentId: string, schoolId: string) {
    await this.findOwned(enrollmentId, schoolId);
    return this.prisma.lesson.findMany({
      where: {
        enrollmentId,
        status: 'SCHEDULED',
        scheduledAt: { gte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 120,
      select: {
        id: true,
        scheduledAt: true,
        durationMinutes: true,
        isMakeup: true,
      },
    });
  }

  // Mostra exatamente o que a troca de horário vai fazer (aula por aula)
  // ANTES de salvar.
  async previewScheduleChange(
    enrollmentId: string,
    schoolId: string,
    query: SchedulePreviewQueryDto,
  ) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const offset = await this.getTimezoneOffset(schoolId);
    const items = await this.planScheduleChange(enrollment, query, offset);
    return {
      total: items.length,
      lessons: items.map((item) => ({
        lessonId: item.lessonId,
        from: item.from,
        to: item.to,
        fromDurationMinutes: item.fromDurationMinutes,
        toDurationMinutes: item.durationMinutes,
      })),
    };
  }

  // ─── EDITAR ───────────────────────────────────────────────────────

  async update(
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
    schoolId: string,
  ) {
    const enrollment = await this.findActive(enrollmentId, schoolId);

    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, user: { schoolId } },
      });
      if (!teacher) throw new NotFoundException('Professor não encontrado');
    }

    const offset = await this.getTimezoneOffset(schoolId);

    // Dia/horário/duração: precisa saber a partir de qual aula vale
    let scheduleItems: ScheduleChangeItem[] = [];
    if (this.hasScheduleChange(enrollment, dto)) {
      scheduleItems = await this.planScheduleChange(
        enrollment,
        {
          fromLessonId: dto.applyFromLessonId,
          weekDay: dto.weekDay,
          startTime: dto.startTime,
          durationMinutes: dto.durationMinutes,
        },
        offset,
      );
    }

    const enrollmentData: Prisma.EnrollmentUncheckedUpdateInput = {};
    if (dto.teacherId) enrollmentData.teacherId = dto.teacherId;
    if (dto.monthlyAmount !== undefined)
      enrollmentData.monthlyAmount = dto.monthlyAmount;
    if (dto.durationMinutes !== undefined)
      enrollmentData.durationMinutes = dto.durationMinutes;
    if (dto.weekDay !== undefined) enrollmentData.weekDay = dto.weekDay;
    if (dto.startTime !== undefined) enrollmentData.startTime = dto.startTime;
    if (
      dto.paymentDueDay !== undefined &&
      dto.paymentDueDay !== enrollment.firstPaymentDueDate.getUTCDate()
    ) {
      // Só o dia-âncora muda: faturas já geradas não são tocadas e as
      // próximas seguem o novo dia (ver getNextPaymentDueDate).
      enrollmentData.firstPaymentDueDate = dateWithAnchorDay(
        enrollment.firstPaymentDueDate,
        dto.paymentDueDay,
      );
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (dto.instrument) {
      operations.push(
        this.prisma.student.update({
          where: { id: enrollment.studentId },
          data: { instrument: dto.instrument },
        }),
      );
    }

    for (const item of scheduleItems) {
      operations.push(
        this.prisma.lesson.update({
          where: { id: item.lessonId },
          data: { scheduledAt: item.to, durationMinutes: item.durationMinutes },
        }),
      );
    }

    if (dto.teacherId && dto.teacherId !== enrollment.teacherId) {
      operations.push(
        this.prisma.lesson.updateMany({
          where: {
            enrollmentId,
            status: 'SCHEDULED',
            scheduledAt: { gte: new Date() },
          },
          data: { teacherId: dto.teacherId },
        }),
      );
    }

    if (Object.keys(enrollmentData).length > 0) {
      operations.push(
        this.prisma.enrollment.update({
          where: { id: enrollmentId },
          data: enrollmentData,
        }),
      );
    }

    if (operations.length > 0) {
      await this.prisma.$transaction(operations);
    }

    return this.enrollmentsService.findOne(enrollmentId, schoolId);
  }

  // ─── ENCERRAR A PARTIR DE UMA AULA ────────────────────────────────

  // As faturas mais recentes (com o período de aulas de cada uma) — a tela
  // usa para o admin escolher "encerrar ao fim de qual fatura".
  async listEndOptions(enrollmentId: string, schoolId: string) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const payments = await this.prisma.payment.findMany({
      where: { enrollmentId },
      orderBy: { dueDate: 'desc' },
      select: PAYMENT_SELECT,
    });
    const withPeriod = payments.filter((p) =>
      periodStartFromKey(p.idempotencyKey),
    );
    return {
      payments: withPeriod
        .slice(0, RECENT_PAYMENTS_LIMIT)
        .map((p) => toInvoiceOption(p, enrollment)),
      olderPaymentsCount: Math.max(
        0,
        withPeriod.length - RECENT_PAYMENTS_LIMIT,
      ),
    };
  }

  async previewEnd(enrollmentId: string, schoolId: string, input: EndInput) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const offset = await this.getTimezoneOffset(schoolId);
    const target = await this.resolveEndTarget(enrollment, offset, input);
    const plan = await this.planEnd(
      this.prisma,
      enrollment,
      input.mode,
      target,
      offset,
    );
    return {
      mode: plan.mode,
      cutoff: plan.cutoff,
      endsAt: plan.endsAt,
      lessonsCancelled: plan.lessonIds.length,
      lessonsKept: plan.lessonsKept,
      olderPaymentsCount: plan.olderPaymentsCount,
      payments: plan.payments.map(toPaymentOption),
    };
  }

  // Encerra a matrícula. As aulas agendadas a partir do corte viram
  // CANCELADAS (continuam no histórico). Faturas:
  //  • NOW / FROM_LESSON: cada fatura mostrada é mantida ou apagada conforme
  //    `deletePaymentIds` (apagar uma paga = estorno).
  //  • AFTER_INVOICE: as faturas DEPOIS da escolhida são apagadas.
  // Sem aulas futuras restantes, o aluno fica inativo na hora; com aulas
  // restantes, segue ativo até o fim da última (`endsAt`) e o cron inativa.
  async end(enrollmentId: string, schoolId: string, input: EndInput) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const offset = await this.getTimezoneOffset(schoolId);
    const target = await this.resolveEndTarget(enrollment, offset, input);

    return this.prisma.$transaction(
      async (tx) => {
        // Recalcula DENTRO da transação: se algo mudou desde o preview
        // (ex: fatura paga agora há pouco), vale o estado real.
        const plan = await this.planEnd(
          tx,
          enrollment,
          input.mode,
          target,
          offset,
        );

        let toDelete: EndPaymentCandidate[];
        if (input.mode === EndMode.AFTER_INVOICE) {
          toDelete = plan.payments; // todas travadas: depois da escolhida
        } else {
          // Só dá pra apagar o que a tela ofereceu (faturas desta matrícula)
          const wanted = new Set(input.deletePaymentIds ?? []);
          const offered = new Set(plan.payments.map((p) => p.id));
          for (const id of wanted) {
            if (!offered.has(id)) {
              throw new BadRequestException(
                'Fatura inválida para esta matrícula',
              );
            }
          }
          toDelete = plan.payments.filter((p) => wanted.has(p.id));
        }

        await tx.lesson.updateMany({
          where: { id: { in: plan.lessonIds }, status: 'SCHEDULED' },
          data: {
            status: 'CANCELLED',
            cancelReason: ENROLLMENT_ENDED_CANCEL_REASON,
          },
        });

        // Fatura presa a um pagamento agregado ainda aberto: cancela o
        // agregado e solta as faturas (mesma regra do createBundle).
        const openBundleIds = [
          ...new Set(
            toDelete
              .filter((p) => p.bundleId && p.bundleStatus === 'PENDING')
              .map((p) => p.bundleId as string),
          ),
        ];
        if (openBundleIds.length > 0) {
          await tx.paymentBundle.updateMany({
            where: { id: { in: openBundleIds }, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });
          await tx.payment.updateMany({
            where: { paymentBundleId: { in: openBundleIds } },
            data: { paymentBundleId: null },
          });
        }

        // Fatura já paga apagada = estorno (o dinheiro é devolvido por fora)
        await tx.payment.deleteMany({
          where: { id: { in: toDelete.map((p) => p.id) } },
        });

        // endsAt no futuro: segue ativa até lá e o cron inativa. Sem aulas
        // restantes: inativa agora e o cron de renovação nunca mais mexe.
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: plan.endsAt
            ? { endsAt: plan.endsAt }
            : { isActive: false, endsAt: new Date() },
        });

        return {
          lessonsCancelled: plan.lessonIds.length,
          lessonsKept: plan.lessonsKept,
          paymentsDeleted: toDelete.length,
          paymentsKept: plan.payments.length - toDelete.length,
          endsAt: plan.endsAt,
          endedNow: plan.endsAt === null,
        };
      },
      { timeout: 20_000 },
    );
  }

  // Chamado pelo cron de hora em hora: inativa as matrículas cujo
  // encerramento agendado (endsAt) já chegou.
  async closeEndedEnrollments(now: Date = new Date()) {
    const { count } = await this.prisma.enrollment.updateMany({
      where: { isActive: true, endsAt: { lte: now } },
      data: { isActive: false },
    });
    return { count };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════════════════════════════

  private async findOwned(enrollmentId: string, schoolId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, schoolId },
    });
    if (!enrollment) throw new NotFoundException('Matrícula não encontrada');
    return enrollment;
  }

  private async findActive(enrollmentId: string, schoolId: string) {
    const enrollment = await this.findOwned(enrollmentId, schoolId);
    if (!enrollment.isActive) {
      throw new BadRequestException('Esta matrícula já foi encerrada');
    }
    return enrollment;
  }

  private async getTimezoneOffset(schoolId: string) {
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: { timezoneOffsetHours: true },
    });
    return school.timezoneOffsetHours;
  }

  private hasScheduleChange(
    enrollment: Enrollment,
    dto: Pick<UpdateEnrollmentDto, 'weekDay' | 'startTime' | 'durationMinutes'>,
  ) {
    return (
      (dto.weekDay !== undefined && dto.weekDay !== enrollment.weekDay) ||
      (dto.startTime !== undefined && dto.startTime !== enrollment.startTime) ||
      (dto.durationMinutes !== undefined &&
        dto.durationMinutes !== enrollment.durationMinutes)
    );
  }

  // Decide, aula por aula, pra onde cada uma vai quando dia/horário/duração
  // mudam. Só mexe em aulas AGENDADAS e regulares (reposição é pontual e
  // fica onde está) da aula escolhida em diante. Aulas anteriores nunca são
  // tocadas.
  private async planScheduleChange(
    enrollment: Enrollment,
    change: {
      fromLessonId?: string;
      weekDay?: number;
      startTime?: string;
      durationMinutes?: number;
    },
    offsetHours: number,
  ): Promise<ScheduleChangeItem[]> {
    const now = new Date();

    if (!change.fromLessonId) {
      const upcoming = await this.prisma.lesson.count({
        where: {
          enrollmentId: enrollment.id,
          status: 'SCHEDULED',
          isMakeup: false,
          scheduledAt: { gte: now },
        },
      });
      if (upcoming > 0) {
        throw new BadRequestException(
          'Escolha a partir de qual aula o novo horário passa a valer',
        );
      }
      // Sem aulas futuras: só a matrícula muda, vale pras próximas geradas
      return [];
    }

    const fromLesson = await this.prisma.lesson.findFirst({
      where: {
        id: change.fromLessonId,
        enrollmentId: enrollment.id,
        status: 'SCHEDULED',
        isMakeup: false,
      },
    });
    if (!fromLesson) {
      throw new BadRequestException('Aula inválida para esta matrícula');
    }

    const lessons = await this.prisma.lesson.findMany({
      where: {
        enrollmentId: enrollment.id,
        status: 'SCHEDULED',
        isMakeup: false,
        scheduledAt: { gte: fromLesson.scheduledAt },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return lessons.map((lesson) => ({
      lessonId: lesson.id,
      from: lesson.scheduledAt,
      to: moveLessonToSchedule(
        lesson.scheduledAt,
        { weekDay: change.weekDay, startTime: change.startTime },
        offsetHours,
        now,
      ),
      fromDurationMinutes: lesson.durationMinutes,
      durationMinutes: change.durationMinutes ?? lesson.durationMinutes,
    }));
  }

  // Descobre o ponto de corte do encerramento conforme o modo escolhido.
  private async resolveEndTarget(
    enrollment: Enrollment,
    offsetHours: number,
    input: EndInput,
  ): Promise<EndTarget> {
    switch (input.mode) {
      case EndMode.NOW:
        return { cutoff: new Date() };

      case EndMode.FROM_LESSON: {
        if (!input.fromLessonId) {
          throw new BadRequestException('Escolha a partir de qual aula');
        }
        const lesson = await this.prisma.lesson.findFirst({
          where: {
            id: input.fromLessonId,
            enrollmentId: enrollment.id,
            status: 'SCHEDULED',
          },
        });
        if (!lesson) {
          throw new BadRequestException('Aula inválida para esta matrícula');
        }
        return { cutoff: lesson.scheduledAt };
      }

      case EndMode.AFTER_INVOICE: {
        if (!input.afterPaymentId) {
          throw new BadRequestException('Escolha a fatura');
        }
        const payment = await this.prisma.payment.findFirst({
          where: { id: input.afterPaymentId, enrollmentId: enrollment.id },
          select: { id: true, idempotencyKey: true },
        });
        if (!payment) {
          throw new BadRequestException('Fatura inválida para esta matrícula');
        }
        const periodStart = periodStartFromKey(payment.idempotencyKey);
        if (!periodStart) {
          throw new BadRequestException(
            'Esta fatura não tem um período de aulas',
          );
        }
        // Corte = meia-noite (horário da escola) do dia seguinte ao fim do
        // período da fatura. Nunca antes de agora.
        const periodEnd = addMonthsKeepingAnchor(
          enrollment.firstLessonDate.getUTCDate(),
          periodStart,
          1,
        );
        const cutoff = new Date(periodEnd.getTime() - offsetHours * HOUR_MS);
        return {
          cutoff: cutoff > new Date() ? cutoff : new Date(),
          afterPayment: { id: payment.id, periodStart },
        };
      }
    }
  }

  // Monta o plano do encerramento:
  //  • Aulas AGENDADAS a partir do corte serão canceladas.
  //  • NOW/FROM_LESSON: as 3 faturas mais recentes (qualquer status) entram
  //    para o admin decidir; cada uma com sugestão (apagar só se nenhuma
  //    aula do ciclo continua valendo).
  //  • AFTER_INVOICE: as faturas depois da escolhida entram travadas (serão
  //    apagadas).
  private async planEnd(
    client: Prisma.TransactionClient,
    enrollment: Enrollment,
    mode: EndMode,
    target: EndTarget,
    offsetHours: number,
  ): Promise<EndPlan> {
    const now = new Date();
    const from = target.cutoff > now ? target.cutoff : now;

    const lessons = await client.lesson.findMany({
      where: { enrollmentId: enrollment.id },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        durationMinutes: true,
      },
    });

    const cancellable = lessons.filter(
      (lesson) =>
        lesson.status === 'SCHEDULED' &&
        lesson.scheduledAt.getTime() >= from.getTime(),
    );
    const cancelledNowIds = new Set(cancellable.map((lesson) => lesson.id));
    // Continuam valendo: aulas dadas ou agendadas antes do corte (aulas já
    // canceladas antes não contam como aula dada)
    const standing = lessons.filter(
      (lesson) =>
        !cancelledNowIds.has(lesson.id) && lesson.status !== 'CANCELLED',
    );

    // Se sobra aula futura, a matrícula vale até o fim da última delas
    const standingFuture = standing.filter(
      (lesson) =>
        lesson.status === 'SCHEDULED' &&
        lesson.scheduledAt.getTime() >= now.getTime(),
    );
    const endsAt = standingFuture.length
      ? new Date(
          Math.max(
            ...standingFuture.map(
              (lesson) =>
                lesson.scheduledAt.getTime() + lesson.durationMinutes * 60_000,
            ),
          ),
        )
      : null;

    const payments = await client.payment.findMany({
      where: { enrollmentId: enrollment.id },
      select: PAYMENT_SELECT,
      orderBy: { dueDate: 'desc' },
    });

    const anchorDay = enrollment.firstLessonDate.getUTCDate();

    let shown: typeof payments;
    let olderPaymentsCount = 0;
    if (mode === EndMode.AFTER_INVOICE && target.afterPayment) {
      const after = target.afterPayment.periodStart;
      shown = payments.filter((p) => {
        const start = periodStartFromKey(p.idempotencyKey);
        return !!start && start > after;
      });
    } else {
      shown = payments.slice(0, RECENT_PAYMENTS_LIMIT);
      olderPaymentsCount = Math.max(0, payments.length - shown.length);
    }
    const locked = mode === EndMode.AFTER_INVOICE;

    const candidates: EndPaymentCandidate[] = shown.map((payment) => {
      let lessonsCancelled = 0;
      let lessonsRemaining = 0;
      const periodStart = periodStartFromKey(payment.idempotencyKey);
      if (periodStart) {
        const periodEnd = addMonthsKeepingAnchor(anchorDay, periodStart, 1);
        const inPeriod = (scheduledAt: Date) => {
          const day = toLocalDay(scheduledAt, offsetHours);
          return day >= periodStart && day < periodEnd;
        };
        lessonsCancelled = cancellable.filter((l) =>
          inPeriod(l.scheduledAt),
        ).length;
        lessonsRemaining = standing.filter((l) =>
          inPeriod(l.scheduledAt),
        ).length;
      }

      return {
        ...toInvoiceOption(payment, enrollment),
        lessonsCancelled,
        lessonsRemaining,
        suggestion:
          locked ||
          (payment.status !== 'PAID' &&
            lessonsCancelled > 0 &&
            lessonsRemaining === 0)
            ? 'DELETE'
            : 'KEEP',
        locked,
        bundleId: payment.paymentBundleId,
        bundleStatus: payment.paymentBundle?.status ?? null,
      };
    });

    return {
      mode,
      cutoff: from,
      endsAt,
      lessonIds: cancellable.map((lesson) => lesson.id),
      lessonsKept: lessons.length - cancellable.length,
      payments: candidates,
      olderPaymentsCount,
    };
  }
}

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  dueDate: true,
  status: true,
  referenceMonth: true,
  idempotencyKey: true,
  paymentBundleId: true,
  paymentBundle: { select: { status: true } },
} satisfies Prisma.PaymentSelect;

type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function toInvoiceOption(
  payment: PaymentRow,
  enrollment: Pick<Enrollment, 'firstLessonDate'>,
): InvoiceOption {
  const periodStart = periodStartFromKey(payment.idempotencyKey);
  const periodEnd = periodStart
    ? addMonthsKeepingAnchor(
        enrollment.firstLessonDate.getUTCDate(),
        periodStart,
        1,
      )
    : null;
  return {
    id: payment.id,
    referenceMonth: payment.referenceMonth,
    amount: payment.amount.toString(),
    dueDate: payment.dueDate,
    status: payment.status,
    periodStart: periodStart ? isoDay(periodStart) : null,
    periodLastDay: periodEnd
      ? isoDay(new Date(periodEnd.getTime() - DAY_MS))
      : null,
  };
}

// Tira os campos internos (pagamento agregado) antes de responder à tela
function toPaymentOption(candidate: EndPaymentCandidate): EndPaymentOption {
  return {
    id: candidate.id,
    referenceMonth: candidate.referenceMonth,
    amount: candidate.amount,
    dueDate: candidate.dueDate,
    status: candidate.status,
    periodStart: candidate.periodStart,
    periodLastDay: candidate.periodLastDay,
    lessonsCancelled: candidate.lessonsCancelled,
    lessonsRemaining: candidate.lessonsRemaining,
    suggestion: candidate.suggestion,
    locked: candidate.locked,
  };
}
