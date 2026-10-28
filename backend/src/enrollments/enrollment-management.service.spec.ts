/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await --
   mocks do Prisma: os retornos são objetos de teste, não tipos reais */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EnrollmentManagementService } from './enrollment-management.service';
import { EndMode } from './dto/end-enrollment.dto';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

const OFFSET = -4; // escola em UTC-4: 08:00 local = 12:00 UTC
const iso = (value: string) => new Date(value);

describe('EnrollmentManagementService', () => {
  const schoolId = 'school-1';

  const prisma = {
    enrollment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    school: { findUniqueOrThrow: jest.fn() },
    teacher: { findFirst: jest.fn() },
    student: { update: jest.fn() },
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    paymentBundle: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const enrollmentsService = { findOne: jest.fn() };

  let service: EnrollmentManagementService;

  // Matrícula de quarta-feira 08:00, ciclos mensais ancorados no dia 4
  const enrollment = (overrides: Record<string, unknown> = {}) => ({
    id: 'enr-1',
    schoolId,
    studentId: 'stu-1',
    teacherId: 'teacher-1',
    isActive: true,
    weekDay: 3,
    startTime: '08:00',
    durationMinutes: 60,
    firstLessonDate: iso('2026-11-04T00:00:00Z'),
    firstPaymentDueDate: iso('2026-11-04T12:00:00Z'),
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.school.findUniqueOrThrow.mockResolvedValue({
      timezoneOffsetHours: OFFSET,
    });
    // Executa a transação "de mentira": array → devolve os valores; função →
    // roda com o próprio prisma como tx.
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : arg,
    );
    prisma.lesson.update.mockImplementation((args) => ({
      op: 'lesson.update',
      args,
    }));
    prisma.lesson.updateMany.mockImplementation((args) => ({
      op: 'lesson.updateMany',
      args,
    }));
    prisma.enrollment.update.mockImplementation((args) => ({
      op: 'enrollment.update',
      args,
    }));
    prisma.student.update.mockImplementation((args) => ({
      op: 'student.update',
      args,
    }));
    enrollmentsService.findOne.mockResolvedValue({ id: 'enr-1' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        EnrollmentManagementService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentsService, useValue: enrollmentsService },
      ],
    }).compile();
    service = moduleRef.get(EnrollmentManagementService);
  });

  describe('update', () => {
    it('troca de dia sem informar a partir de qual aula → erro quando há aulas futuras', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      prisma.lesson.count.mockResolvedValue(4);

      await expect(
        service.update('enr-1', { weekDay: 2 }, schoolId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('troca de dia sem aulas futuras → só atualiza a matrícula', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      prisma.lesson.count.mockResolvedValue(0);

      await service.update('enr-1', { weekDay: 2 }, schoolId);

      expect(prisma.lesson.update).not.toHaveBeenCalled();
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { weekDay: 2 },
      });
    });

    it('move a aula escolhida e as seguintes; as anteriores não são consultadas', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'l2',
        scheduledAt: iso('2099-11-11T12:00:00Z'),
      });
      prisma.lesson.findMany.mockResolvedValue([
        {
          id: 'l2',
          scheduledAt: iso('2099-11-11T12:00:00Z'),
          durationMinutes: 60,
        }, // quarta
        {
          id: 'l3',
          scheduledAt: iso('2099-11-18T12:00:00Z'),
          durationMinutes: 60,
        }, // quarta
      ]);

      await service.update(
        'enr-1',
        { weekDay: 5, startTime: '09:30', applyFromLessonId: 'l2' },
        schoolId,
      );

      // busca só aulas agendadas, regulares e a partir da aula escolhida
      expect(prisma.lesson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'SCHEDULED',
            isMakeup: false,
            scheduledAt: { gte: iso('2099-11-11T12:00:00Z') },
          }),
        }),
      );

      // quarta → sexta (+2 dias), 09:30 local = 13:30 UTC
      expect(prisma.lesson.update).toHaveBeenCalledWith({
        where: { id: 'l2' },
        data: { scheduledAt: iso('2099-11-13T13:30:00Z'), durationMinutes: 60 },
      });
      expect(prisma.lesson.update).toHaveBeenCalledWith({
        where: { id: 'l3' },
        data: { scheduledAt: iso('2099-11-20T13:30:00Z'), durationMinutes: 60 },
      });
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { weekDay: 5, startTime: '09:30' },
      });
    });

    it('rejeita aula que não é desta matrícula', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      prisma.lesson.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'enr-1',
          { startTime: '10:00', applyFromLessonId: 'outra' },
          schoolId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('trocar professor atualiza também as aulas futuras agendadas', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      prisma.teacher.findFirst.mockResolvedValue({ id: 'teacher-2' });

      await service.update('enr-1', { teacherId: 'teacher-2' }, schoolId);

      expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
        where: {
          enrollmentId: 'enr-1',
          status: 'SCHEDULED',
          scheduledAt: { gte: expect.any(Date) },
        },
        data: { teacherId: 'teacher-2' },
      });
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { teacherId: 'teacher-2' },
      });
    });

    it('instrumento é gravado no aluno e valor/vencimento na matrícula', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());

      await service.update(
        'enr-1',
        { instrument: 'PIANO', monthlyAmount: '300.00', paymentDueDay: 20 },
        schoolId,
      );

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'stu-1' },
        data: { instrument: 'PIANO' },
      });
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: {
          monthlyAmount: '300.00',
          firstPaymentDueDate: iso('2026-11-20T12:00:00Z'),
        },
      });
    });

    it('não permite editar matrícula encerrada', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(
        enrollment({ isActive: false }),
      );
      await expect(
        service.update('enr-1', { monthlyAmount: '1.00' }, schoolId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('prévia da troca de horário', () => {
    it('só a duração muda: mesma data/hora, duração antes e depois', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(enrollment());
      const lesson = {
        id: 'l1',
        scheduledAt: iso('2099-11-05T19:30:00Z'),
        durationMinutes: 60,
      };
      prisma.lesson.findFirst.mockResolvedValue(lesson);
      prisma.lesson.findMany.mockResolvedValue([lesson]);

      const result = await service.previewScheduleChange('enr-1', schoolId, {
        fromLessonId: 'l1',
        durationMinutes: 45,
      });

      expect(result.lessons).toEqual([
        {
          lessonId: 'l1',
          from: lesson.scheduledAt,
          to: lesson.scheduledAt,
          fromDurationMinutes: 60,
          toDurationMinutes: 45,
        },
      ]);
    });
  });

  describe('encerrar matrícula', () => {
    // Ciclo 1: 04/11 a 03/12 (quartas 04, 11, 18, 25/11)
    // Ciclo 2: 04/12 a 03/01 (quartas 09, 16/12 nos dados abaixo)
    const lessons = [
      {
        id: 'a1',
        scheduledAt: iso('2099-11-04T12:00:00Z'),
        status: 'COMPLETED',
        durationMinutes: 60,
      },
      {
        id: 'a2',
        scheduledAt: iso('2099-11-11T12:00:00Z'),
        status: 'COMPLETED',
        durationMinutes: 60,
      },
      {
        id: 'a3',
        scheduledAt: iso('2099-11-18T12:00:00Z'),
        status: 'SCHEDULED',
        durationMinutes: 60,
      },
      {
        id: 'a4',
        scheduledAt: iso('2099-11-25T12:00:00Z'),
        status: 'SCHEDULED',
        durationMinutes: 60,
      },
      {
        id: 'b1',
        scheduledAt: iso('2099-12-09T12:00:00Z'),
        status: 'SCHEDULED',
        durationMinutes: 60,
      },
      {
        id: 'b2',
        scheduledAt: iso('2099-12-16T12:00:00Z'),
        status: 'SCHEDULED',
        durationMinutes: 60,
      },
    ];
    const payment = (
      id: string,
      periodStart: string,
      status: string,
      extra: Record<string, unknown> = {},
    ) => ({
      id,
      amount: '200.00',
      dueDate: iso(`${periodStart}T12:00:00Z`),
      status,
      referenceMonth: periodStart.slice(0, 7),
      idempotencyKey: `stu-1-${periodStart}`,
      paymentBundleId: null,
      paymentBundle: null,
      ...extra,
    });
    const fromLesson = (id: string) => {
      const lesson = lessons.find((l) => l.id === id)!;
      prisma.lesson.findFirst.mockResolvedValue({
        id,
        scheduledAt: lesson.scheduledAt,
      });
    };
    const afterInvoice = (id: string, periodStart: string) =>
      prisma.payment.findFirst.mockResolvedValue({
        id,
        idempotencyKey: `stu-1-${periodStart}`,
      });
    const A4_END = iso('2099-11-25T13:00:00Z');

    beforeEach(() => {
      prisma.enrollment.findFirst.mockResolvedValue(
        enrollment({ firstLessonDate: iso('2099-11-04T00:00:00Z') }),
      );
      prisma.lesson.findMany.mockResolvedValue(lessons);
    });

    describe('a partir de uma aula', () => {
      it('prévia: conta aulas, sugere apagar só a fatura sem aulas restantes e mostra o período', async () => {
        fromLesson('a4');
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'), // todas canceladas → apagar
          payment('p1', '2099-11-04', 'OVERDUE'), // a1, a2, a3 continuam → manter
        ]);

        const result = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.FROM_LESSON,
          fromLessonId: 'a4',
        });

        expect(result.lessonsCancelled).toBe(3);
        expect(result.lessonsKept).toBe(3);
        expect(result.endsAt).toEqual(iso('2099-11-18T13:00:00Z')); // fim da a3
        expect(result.payments).toEqual([
          expect.objectContaining({
            id: 'p2',
            lessonsCancelled: 2,
            lessonsRemaining: 0,
            suggestion: 'DELETE',
            locked: false,
            periodStart: '2099-12-04',
            periodLastDay: '2100-01-03',
          }),
          expect.objectContaining({
            id: 'p1',
            lessonsCancelled: 1,
            lessonsRemaining: 3,
            suggestion: 'KEEP',
          }),
        ]);
      });

      it('exige a aula de corte', async () => {
        await expect(
          service.previewEnd('enr-1', schoolId, { mode: EndMode.FROM_LESSON }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });

      it('cancela as aulas (não apaga), apaga só as faturas escolhidas e segue ativa até a última aula', async () => {
        fromLesson('a4');
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'),
          payment('p1', '2099-11-04', 'OVERDUE'),
        ]);

        const result = await service.end('enr-1', schoolId, {
          mode: EndMode.FROM_LESSON,
          fromLessonId: 'a4',
          deletePaymentIds: ['p2'],
        });

        expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['a4', 'b1', 'b2'] }, status: 'SCHEDULED' },
          data: { status: 'CANCELLED', cancelReason: 'Matrícula encerrada' },
        });
        expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['p2'] } },
        });
        // ainda tem a3 pela frente: continua ativa, só ganha a data final
        expect(prisma.enrollment.update).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
          data: { endsAt: iso('2099-11-18T13:00:00Z') },
        });
        expect(result).toMatchObject({
          lessonsCancelled: 3,
          paymentsDeleted: 1,
          paymentsKept: 1,
          endedNow: false,
        });
      });

      it('cortando na primeira aula futura não sobra aula: inativa na hora', async () => {
        fromLesson('a3');
        prisma.payment.findMany.mockResolvedValue([]);

        const result = await service.end('enr-1', schoolId, {
          mode: EndMode.FROM_LESSON,
          fromLessonId: 'a3',
        });

        expect(prisma.enrollment.update).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
          data: { isActive: false, endsAt: expect.any(Date) },
        });
        expect(result.endedNow).toBe(true);
      });
    });

    describe('agora', () => {
      it('cancela todas as aulas agendadas e inativa na hora', async () => {
        prisma.payment.findMany.mockResolvedValue([]);

        const result = await service.end('enr-1', schoolId, {
          mode: EndMode.NOW,
        });

        expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
          where: {
            id: { in: ['a3', 'a4', 'b1', 'b2'] },
            status: 'SCHEDULED',
          },
          data: { status: 'CANCELLED', cancelReason: 'Matrícula encerrada' },
        });
        expect(prisma.enrollment.update).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
          data: { isActive: false, endsAt: expect.any(Date) },
        });
        expect(result.endedNow).toBe(true);
      });

      it('sem faturas marcadas nada é apagado, nem a sugerida', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'),
        ]);

        const result = await service.end('enr-1', schoolId, {
          mode: EndMode.NOW,
        });

        expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: [] } },
        });
        expect(result.paymentsDeleted).toBe(0);
        expect(result.paymentsKept).toBe(1);
      });

      it('só as 3 faturas mais recentes são oferecidas; as outras ficam fora', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p5', '2100-03-04', 'PENDING'),
          payment('p4', '2100-02-04', 'PENDING'),
          payment('p3', '2100-01-04', 'PENDING'),
          payment('p2', '2099-12-04', 'OVERDUE'),
          payment('p1', '2099-11-04', 'OVERDUE'),
        ]);

        const preview = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.NOW,
        });
        expect(preview.payments.map((p) => p.id)).toEqual(['p5', 'p4', 'p3']);
        expect(preview.olderPaymentsCount).toBe(2);

        await expect(
          service.end('enr-1', schoolId, {
            mode: EndMode.NOW,
            deletePaymentIds: ['p1'],
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.lesson.updateMany).not.toHaveBeenCalled();
        expect(prisma.enrollment.update).not.toHaveBeenCalled();
      });

      it('estornar: fatura paga escolhida é apagada (sugestão é manter)', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PAID'),
          payment('p1', '2099-11-04', 'PAID'),
        ]);

        const preview = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.NOW,
        });
        expect(preview.payments.map((p) => p.suggestion)).toEqual([
          'KEEP',
          'KEEP',
        ]);

        await service.end('enr-1', schoolId, {
          mode: EndMode.NOW,
          deletePaymentIds: ['p2'],
        });
        expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['p2'] } },
        });
      });

      it('aulas já canceladas antes não contam como aula dada no ciclo', async () => {
        prisma.lesson.findMany.mockResolvedValue([
          ...lessons,
          {
            id: 'c1',
            scheduledAt: iso('2099-12-05T12:00:00Z'),
            status: 'CANCELLED',
            durationMinutes: 60,
          },
        ]);
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'),
        ]);

        const result = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.NOW,
        });

        expect(result.payments[0].suggestion).toBe('DELETE');
        expect(result.lessonsKept).toBe(3); // a1, a2 (dadas) + c1 (já cancelada antes)
      });

      it('fatura apagada num pagamento agregado aberto cancela o agregado e solta as outras', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING', {
            paymentBundleId: 'bundle-1',
            paymentBundle: { status: 'PENDING' },
          }),
        ]);

        await service.end('enr-1', schoolId, {
          mode: EndMode.NOW,
          deletePaymentIds: ['p2'],
        });

        expect(prisma.paymentBundle.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['bundle-1'] }, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        expect(prisma.payment.updateMany).toHaveBeenCalledWith({
          where: { paymentBundleId: { in: ['bundle-1'] } },
          data: { paymentBundleId: null },
        });
      });

      it('fatura paga dentro de um agregado já pago: o agregado não é mexido', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PAID', {
            paymentBundleId: 'bundle-9',
            paymentBundle: { status: 'PAID' },
          }),
        ]);

        await service.end('enr-1', schoolId, {
          mode: EndMode.NOW,
          deletePaymentIds: ['p2'],
        });

        expect(prisma.paymentBundle.updateMany).not.toHaveBeenCalled();
        expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['p2'] } },
        });
      });

      it('fatura avulsa (sem período) é oferecida sem sugestão de apagar', async () => {
        prisma.payment.findMany.mockResolvedValue([
          {
            ...payment('p9', '2099-12-04', 'PENDING'),
            idempotencyKey: 'manual-1',
          },
        ]);

        const result = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.NOW,
        });

        expect(result.payments).toEqual([
          expect.objectContaining({
            id: 'p9',
            lessonsCancelled: 0,
            lessonsRemaining: 0,
            suggestion: 'KEEP',
            periodStart: null,
            periodLastDay: null,
          }),
        ]);
      });
    });

    describe('ao fim de uma fatura', () => {
      // Escola em UTC-4: o ciclo 1 termina em 03/12; corte = 04/12 00:00 local
      it('cancela as aulas depois do período, apaga as faturas seguintes e vale até a última aula do período', async () => {
        afterInvoice('p1', '2099-11-04');
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'),
          payment('p1', '2099-11-04', 'PAID'),
        ]);

        const preview = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.AFTER_INVOICE,
          afterPaymentId: 'p1',
        });
        expect(preview.cutoff).toEqual(iso('2099-12-04T04:00:00Z'));
        expect(preview.lessonsCancelled).toBe(2); // b1, b2
        expect(preview.endsAt).toEqual(A4_END);
        expect(preview.payments).toEqual([
          expect.objectContaining({
            id: 'p2',
            locked: true,
            suggestion: 'DELETE',
          }),
        ]);

        const result = await service.end('enr-1', schoolId, {
          mode: EndMode.AFTER_INVOICE,
          afterPaymentId: 'p1',
          // o que o app mandar aqui é ignorado neste modo
          deletePaymentIds: ['p1'],
        });

        expect(prisma.lesson.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['b1', 'b2'] }, status: 'SCHEDULED' },
          data: { status: 'CANCELLED', cancelReason: 'Matrícula encerrada' },
        });
        expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
          where: { id: { in: ['p2'] } },
        });
        expect(prisma.enrollment.update).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
          data: { endsAt: A4_END },
        });
        expect(result).toMatchObject({ paymentsDeleted: 1, endedNow: false });
      });

      it('fatura mais recente escolhida: nada depois dela para apagar', async () => {
        afterInvoice('p2', '2099-12-04');
        prisma.payment.findMany.mockResolvedValue([
          payment('p2', '2099-12-04', 'PENDING'),
          payment('p1', '2099-11-04', 'PAID'),
        ]);

        const preview = await service.previewEnd('enr-1', schoolId, {
          mode: EndMode.AFTER_INVOICE,
          afterPaymentId: 'p2',
        });

        expect(preview.lessonsCancelled).toBe(0);
        expect(preview.payments).toEqual([]);
        expect(preview.endsAt).toEqual(iso('2099-12-16T13:00:00Z')); // fim da b2
      });

      it('exige a fatura e recusa fatura de outra matrícula ou sem período', async () => {
        await expect(
          service.previewEnd('enr-1', schoolId, {
            mode: EndMode.AFTER_INVOICE,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        prisma.payment.findFirst.mockResolvedValue(null);
        await expect(
          service.previewEnd('enr-1', schoolId, {
            mode: EndMode.AFTER_INVOICE,
            afterPaymentId: 'x',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);

        prisma.payment.findFirst.mockResolvedValue({
          id: 'p9',
          idempotencyKey: 'manual-1',
        });
        await expect(
          service.previewEnd('enr-1', schoolId, {
            mode: EndMode.AFTER_INVOICE,
            afterPaymentId: 'p9',
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });

    describe('faturas disponíveis para escolher', () => {
      it('devolve as 3 mais recentes com período e conta as mais antigas', async () => {
        prisma.payment.findMany.mockResolvedValue([
          payment('p4', '2100-02-04', 'PENDING'),
          payment('p3', '2100-01-04', 'PENDING'),
          payment('p2', '2099-12-04', 'PAID'),
          payment('p1', '2099-11-04', 'PAID'),
          {
            ...payment('p0', '2099-10-04', 'PAID'),
            idempotencyKey: 'manual-1',
          },
        ]);

        const result = await service.listEndOptions('enr-1', schoolId);

        expect(result.payments.map((p) => p.id)).toEqual(['p4', 'p3', 'p2']);
        expect(result.olderPaymentsCount).toBe(1); // p1 (a avulsa não conta)
        expect(result.payments[2]).toMatchObject({
          periodStart: '2099-12-04',
          periodLastDay: '2100-01-03',
        });
      });
    });
  });

  describe('encerramento agendado', () => {
    it('o cron inativa as matrículas cujo endsAt já passou', async () => {
      prisma.enrollment.updateMany.mockResolvedValue({ count: 2 });
      const now = iso('2099-11-25T14:00:00Z');

      const result = await service.closeEndedEnrollments(now);

      expect(prisma.enrollment.updateMany).toHaveBeenCalledWith({
        where: { isActive: true, endsAt: { lte: now } },
        data: { isActive: false },
      });
      expect(result.count).toBe(2);
    });
  });
});
