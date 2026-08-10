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

  async create(dto: CreateEnrollmentDto, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    if (dto.teacherId) {
      const teacher = await this.prisma.teacher.findFirst({
        where: { id: dto.teacherId, user: { schoolId } },
      });
      if (!teacher) throw new NotFoundException('Professor não encontrado');
    }

    const startDate = new Date(dto.startDate);

    const enrollment = await this.prisma.enrollment.create({
      data: {
        schoolId,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        weekDay: startDate.getUTCDay(), // derivado do startDate — sem redundância
        startTime: dto.startTime,
        durationMinutes: dto.durationMinutes ?? 60,
        monthlyAmount: dto.monthlyAmount,
        startDate,
        // frequency fica fixo em WEEKLY (default do schema) no MVP
      },
    });

    // o primeiro ciclo sempre começa exatamente no startDate. O PIX
    // NÃO é gerado aqui — só quando o usuário abrir a tela de
    // pagamento (ver ensurePaymentCharge no PaymentsService). Isso
    // evita gerar cobranças no gateway que talvez nunca sejam vistas,
    // e evita o QR expirar antes do usuário sequer abrir o app.
    await this.generatePeriod(
      enrollment.id,
      startDate,
      dto.firstPaymentPaid ?? false,
    );

    return this.findOne(enrollment.id, schoolId);
  }

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

    const nextPeriodStart = this.getNextPeriodStart(enrollment);
    const nextPeriodKey = this.toPeriodKey(nextPeriodStart);

    if (enrollment.lastGeneratedMonth === nextPeriodKey) {
      throw new BadRequestException(`Período ${nextPeriodKey} já foi gerado`);
    }

    // idem: sem geração automática de PIX aqui também
    await this.generatePeriod(enrollmentId, nextPeriodStart, false);

    return this.findOne(enrollmentId, schoolId);
  }

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

  async findAllBySchool(schoolId: string) {
    return this.prisma.enrollment.findMany({
      where: { schoolId },
      include: {
        student: {
          select: {
            id: true,
            name: true, // nome do aluno matriculado
            birthDate: true,
            instrument: true,
            user: { select: { name: true, email: true } }, // conta/responsável, se precisar contato
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

  // enrollments.service.ts
  async findByStudent(studentId: string, schoolId: string) {
    return this.prisma.enrollment.findFirst({
      where: { studentId, schoolId, isActive: true },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });
  }

  // ─── CRON 1: gera a fatura/aulas do próximo período mensal,
  // ~10 dias antes do início desse próximo período. O PIX dessa
  // fatura só será gerado quando o usuário abrir a tela de
  // pagamento (ver ensurePaymentCharge em PaymentsService).
  async renewDueSoon(daysBeforeStart: number = 10) {
    const activeEnrollments = await this.prisma.enrollment.findMany({
      where: { isActive: true },
    });

    const results: { enrollmentId: string; generated: string }[] = [];

    for (const enrollment of activeEnrollments) {
      try {
        const nextPeriodStart = this.getNextPeriodStart(enrollment);
        const nextPeriodKey = this.toPeriodKey(nextPeriodStart);

        if (enrollment.lastGeneratedMonth === nextPeriodKey) continue;

        const daysRemaining = Math.ceil(
          (nextPeriodStart.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        if (daysRemaining <= daysBeforeStart) {
          await this.generatePeriod(enrollment.id, nextPeriodStart, false);
          results.push({
            enrollmentId: enrollment.id,
            generated: nextPeriodKey,
          });
        }
      } catch (err) {
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

  // ─── CRON 2: marca como OVERDUE toda fatura PENDING cuja dueDate
  // já passou (atraso = 1 dia após a dueDate)
  async markOverduePayments() {
    const now = new Date();
    // usa UTC pra bater com dueDate, que é sempre salva em UTC meia-noite
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    const result = await this.prisma.payment.updateMany({
      where: {
        status: 'PENDING',
        dueDate: { lt: todayStart },
      },
      data: { status: 'OVERDUE' },
    });

    return { updatedCount: result.count };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────

  // markAsPaid: só usado na criação, quando o admin marca que a
  // primeira mensalidade já foi paga na hora (ex: presencialmente)
  //
  // periodStart: data de início do ciclo mensal (= dueDate da
  // fatura desse período, e também o primeiro dia possível de aula)
  private async generatePeriod(
    enrollmentId: string,
    periodStart: Date,
    markAsPaid: boolean,
  ) {
    const enrollment = await this.prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
    });

    const periodKey = this.toPeriodKey(periodStart);
    const lessons = this.buildLessonsForPeriod(enrollment, periodStart);
    const idempotencyKey = `${enrollment.studentId}-${periodKey}`;

    // a dueDate é o próprio início do período — é o "dia limite" pra
    // pagar (a partir do dia seguinte já conta atraso)
    const dueDate = periodStart;

    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const initialStatus = markAsPaid
      ? 'PAID'
      : dueDate < todayStart
        ? 'OVERDUE'
        : 'PENDING';

    const [, payment] = await this.prisma.$transaction([
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

      this.prisma.payment.upsert({
        where: { idempotencyKey },
        update: {},
        create: {
          schoolId: enrollment.schoolId,
          studentId: enrollment.studentId,
          enrollmentId: enrollment.id,
          amount: enrollment.monthlyAmount,
          dueDate,
          status: initialStatus,
          paidAt: markAsPaid ? new Date() : null,
          paymentMethod: markAsPaid ? 'MANUAL_PIX' : 'GATEWAY',
          referenceMonth: periodKey,
          idempotencyKey,
        },
      }),

      this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: { lastGeneratedMonth: periodKey, lastPeriodStart: periodStart },
      }),
    ]);

    return payment;
  }

  // gera todas as ocorrências do weekDay entre periodStart (inclusive)
  // e o início do próximo período mensal (exclusive)
  private buildLessonsForPeriod(
    enrollment: Pick<
      Enrollment,
      'weekDay' | 'startTime' | 'durationMinutes' | 'frequency' | 'startDate'
    >,
    periodStart: Date,
  ): Date[] {
    const [hours, minutes] = enrollment.startTime.split(':').map(Number) as [
      number,
      number,
    ];

    // o fim do período é o início do próximo ciclo mensal (mesmo dia
    // "âncora" original da matrícula, com clamping) — não mais
    // periodStart + 30 dias fixos. Usa enrollment.startDate (nunca
    // periodStart) como âncora, pelo mesmo motivo do getNextPeriodStart.
    const anchorDay = enrollment.startDate.getUTCDate();
    const periodEnd = this.getNextMonthlyDate(anchorDay, periodStart, 1);
    const dates: Date[] = [];

    // opera em UTC pra não depender do fuso do servidor
    const cursor = new Date(
      Date.UTC(
        periodStart.getUTCFullYear(),
        periodStart.getUTCMonth(),
        periodStart.getUTCDate(),
      ),
    );

    while (cursor < periodEnd) {
      if (cursor.getUTCDay() === enrollment.weekDay) {
        dates.push(
          new Date(
            Date.UTC(
              cursor.getUTCFullYear(),
              cursor.getUTCMonth(),
              cursor.getUTCDate(),
              hours,
              minutes,
              0,
              0,
            ),
          ),
        );
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // BIWEEKLY existe no schema mas fica fora de uso no MVP (ver DTO)
    if (enrollment.frequency === 'BIWEEKLY') {
      return dates.filter((_, index) => index % 2 === 0);
    }

    return dates;
  }

  // próxima data-âncora = início do próximo ciclo mensal, a partir do
  // último período gerado. Se nunca gerou nenhum período ainda, usa
  // o startDate da matrícula (primeiro ciclo).
  //
  // IMPORTANTE: o "dia âncora" usado no clamping é SEMPRE
  // enrollment.startDate.getUTCDate() — nunca o dia do último período
  // gerado. Se fosse o último período, um mês curto (fevereiro) faria
  // o ciclo "cair" pro dia 28 e ficar preso nesse dia pra sempre, mesmo
  // em meses com 30/31 dias depois. Usando sempre o dia original da
  // matrícula, o ciclo volta pro dia certo assim que o mês permitir
  // (ex: âncora 31 → fev cai em 28, mas março volta pro 31).
  private getNextPeriodStart(
    enrollment: Pick<Enrollment, 'lastPeriodStart' | 'startDate'>,
  ): Date {
    if (!enrollment.lastPeriodStart) {
      return new Date(enrollment.startDate);
    }
    const anchorDay = enrollment.startDate.getUTCDate();
    return this.getNextMonthlyDate(anchorDay, enrollment.lastPeriodStart, 1);
  }

  /**
   * Calcula a próxima data de um ciclo mensal, mantendo o "dia âncora"
   * fixo (o dia em que a matrícula começou — enrollment.startDate). Se
   * esse dia não existir no mês de destino, usa o último dia válido
   * daquele mês (clamping) — sem "estourar" pro mês seguinte e sem
   * ficar preso no dia menor depois (no mês seguinte, se ele tiver dias
   * suficientes, volta pro dia âncora original).
   *
   * @param anchorDay - o dia do mês original da matrícula (1-31),
   *   sempre derivado de enrollment.startDate, nunca de um período já
   *   clampado — é isso que evita o bug de "ficar presa" em dias 28/30.
   * @param referenceDate - a partir de que mês/ano contar os
   *   `monthsToAdd` (normalmente o último período gerado).
   *
   * Ex: anchorDay = 31, referência = janeiro → destino fevereiro → 28/29
   * Ex: anchorDay = 31, referência = fevereiro → destino março → volta pro 31
   * Ex: anchorDay = 15, qualquer referência → sempre 15
   */
  private getNextMonthlyDate(
    anchorDay: number,
    referenceDate: Date,
    monthsToAdd: number,
  ): Date {
    const targetYear = referenceDate.getUTCFullYear();
    const targetMonth = referenceDate.getUTCMonth() + monthsToAdd;

    // dia 0 do mês seguinte ao de destino = último dia do mês de destino
    // (jeito clássico em JS de descobrir quantos dias tem um mês, sem
    // precisar de tabela nem checar ano bissexto manualmente)
    const lastDayOfTargetMonth = new Date(
      Date.UTC(targetYear, targetMonth + 1, 0),
    ).getUTCDate();

    const finalDay = Math.min(anchorDay, lastDayOfTargetMonth);

    return new Date(Date.UTC(targetYear, targetMonth, finalDay));
  }

  // rótulo legível do período, usado em idempotencyKey/referenceMonth.
  // formato: "YYYY-MM-DD" da data de início do ciclo — garante que
  // dois ciclos diferentes nunca colidem, mesmo caindo no mesmo mês civil
  private toPeriodKey(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
