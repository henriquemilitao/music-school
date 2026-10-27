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
  durationMinutes: number;
}

interface PlannedPayment {
  id: string;
  referenceMonth: string;
  amount: string;
  dueDate: Date;
  status: string;
}

export interface EndPlan {
  cutoff: Date;
  lessonIds: string[];
  lessonsRemoved: number;
  lessonsKept: number;
  paymentsToDelete: PlannedPayment[];
  // Faturas JÁ PAGAS cujas aulas foram removidas: ficam intactas (não há
  // estorno automático) e o admin é avisado.
  paidPaymentsAffected: PlannedPayment[];
  bundleIds: string[];
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
      lessons: items.map(({ lessonId, from, to }) => ({ lessonId, from, to })),
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

  async previewEnd(
    enrollmentId: string,
    schoolId: string,
    fromLessonId?: string,
  ) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const offset = await this.getTimezoneOffset(schoolId);
    const cutoff = await this.resolveCutoff(enrollment, fromLessonId);
    return this.toSummary(
      await this.planEnd(this.prisma, enrollment, cutoff, offset),
    );
  }

  async end(enrollmentId: string, schoolId: string, fromLessonId?: string) {
    const enrollment = await this.findActive(enrollmentId, schoolId);
    const offset = await this.getTimezoneOffset(schoolId);
    const cutoff = await this.resolveCutoff(enrollment, fromLessonId);

    const plan = await this.prisma.$transaction(
      async (tx) => {
        // Recalcula DENTRO da transação: se algo mudou desde o preview
        // (ex: fatura paga agora há pouco), vale o estado real.
        const plan = await this.planEnd(tx, enrollment, cutoff, offset);

        await tx.lesson.deleteMany({ where: { id: { in: plan.lessonIds } } });

        if (plan.bundleIds.length > 0) {
          // Fatura presa a um pagamento agregado ainda aberto: cancela o
          // agregado e solta as faturas (mesma regra do createBundle).
          await tx.paymentBundle.updateMany({
            where: { id: { in: plan.bundleIds }, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });
          await tx.payment.updateMany({
            where: { paymentBundleId: { in: plan.bundleIds } },
            data: { paymentBundleId: null },
          });
        }

        await tx.payment.deleteMany({
          where: { id: { in: plan.paymentsToDelete.map((p) => p.id) } },
        });

        // isActive=false: o cron nunca mais renova e o aluno sai da lista
        // de ativos. Aulas anteriores à data de corte seguem no histórico.
        await tx.enrollment.update({
          where: { id: enrollmentId },
          data: { isActive: false },
        });

        return plan;
      },
      { timeout: 20_000 },
    );

    return this.toSummary(plan);
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
      durationMinutes: change.durationMinutes ?? lesson.durationMinutes,
    }));
  }

  // Data de corte do encerramento: a aula escolhida (ela já NÃO acontece) ou,
  // sem escolha, "agora".
  private async resolveCutoff(enrollment: Enrollment, fromLessonId?: string) {
    if (!fromLessonId) return new Date();

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: fromLessonId,
        enrollmentId: enrollment.id,
        status: 'SCHEDULED',
      },
    });
    if (!lesson) {
      throw new BadRequestException('Aula inválida para esta matrícula');
    }
    return lesson.scheduledAt;
  }

  // Regra de quais faturas somem ao encerrar a partir de `cutoff`:
  //  • Aulas na data de corte ou depois (agendadas/canceladas) são removidas.
  //  • Cada fatura em aberto (PENDING/OVERDUE) cobre um ciclo mensal de aulas.
  //    Se TODAS as aulas do ciclo foram removidas → a fatura é apagada.
  //  • Se sobrou pelo menos uma aula no ciclo (ainda vai ser dada), a fatura
  //    fica — mesmo atrasada.
  //  • Faturas pagas nunca são apagadas; só avisamos quando as aulas delas
  //    foram removidas.
  private async planEnd(
    client: Prisma.TransactionClient,
    enrollment: Enrollment,
    cutoff: Date,
    offsetHours: number,
  ): Promise<EndPlan> {
    const lessons = await client.lesson.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, scheduledAt: true, status: true },
    });

    const removable = lessons.filter(
      (lesson) =>
        lesson.scheduledAt.getTime() >= cutoff.getTime() &&
        lesson.status !== 'COMPLETED',
    );
    const removedIds = new Set(removable.map((lesson) => lesson.id));
    const kept = lessons.filter((lesson) => !removedIds.has(lesson.id));

    const payments = await client.payment.findMany({
      where: { enrollmentId: enrollment.id },
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
        referenceMonth: true,
        idempotencyKey: true,
        paymentBundleId: true,
      },
    });

    const anchorDay = enrollment.firstLessonDate.getUTCDate();
    const paymentsToDelete: PlannedPayment[] = [];
    const paidPaymentsAffected: PlannedPayment[] = [];
    const bundleIds = new Set<string>();

    for (const payment of payments) {
      const periodStart = periodStartFromKey(payment.idempotencyKey);
      if (!periodStart) continue; // fatura avulsa/antiga: não mexe

      const periodEnd = addMonthsKeepingAnchor(anchorDay, periodStart, 1);
      const inPeriod = (scheduledAt: Date) => {
        const day = toLocalDay(scheduledAt, offsetHours);
        return day >= periodStart && day < periodEnd;
      };

      const hasKeptLesson = kept.some((lesson) => inPeriod(lesson.scheduledAt));
      const hasRemovedLesson = removable.some((lesson) =>
        inPeriod(lesson.scheduledAt),
      );
      if (hasKeptLesson || !hasRemovedLesson) continue;

      const planned: PlannedPayment = {
        id: payment.id,
        referenceMonth: payment.referenceMonth,
        amount: payment.amount.toString(),
        dueDate: payment.dueDate,
        status: payment.status,
      };

      if (payment.status === 'PAID') {
        paidPaymentsAffected.push(planned);
        continue;
      }

      paymentsToDelete.push(planned);
      if (payment.paymentBundleId) bundleIds.add(payment.paymentBundleId);
    }

    return {
      cutoff,
      lessonIds: removable.map((lesson) => lesson.id),
      lessonsRemoved: removable.length,
      lessonsKept: kept.length,
      paymentsToDelete,
      paidPaymentsAffected,
      bundleIds: [...bundleIds],
    };
  }

  private toSummary(plan: EndPlan) {
    return {
      cutoff: plan.cutoff,
      lessonsRemoved: plan.lessonsRemoved,
      lessonsKept: plan.lessonsKept,
      paymentsDeleted: plan.paymentsToDelete,
      paidPaymentsAffected: plan.paidPaymentsAffected,
    };
  }
}
