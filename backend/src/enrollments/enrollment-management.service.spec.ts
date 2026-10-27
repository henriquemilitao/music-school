/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await --
   mocks do Prisma: os retornos são objetos de teste, não tipos reais */
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EnrollmentManagementService } from './enrollment-management.service';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

const OFFSET = -4; // escola em UTC-4: 08:00 local = 12:00 UTC
const iso = (value: string) => new Date(value);

describe('EnrollmentManagementService', () => {
  const schoolId = 'school-1';

  const prisma = {
    enrollment: { findFirst: jest.fn(), update: jest.fn() },
    school: { findUniqueOrThrow: jest.fn() },
    teacher: { findFirst: jest.fn() },
    student: { update: jest.fn() },
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    payment: {
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

  describe('encerrar a partir de uma aula', () => {
    // Ciclo 1: 04/11 a 03/12 (4 quartas: 04, 11, 18, 25/11)
    // Ciclo 2: 04/12 a 03/01 (quartas: 02/12 está no ciclo 1; 09, 16, 23, 30/12)
    const lessons = [
      {
        id: 'a1',
        scheduledAt: iso('2099-11-04T12:00:00Z'),
        status: 'COMPLETED',
      },
      {
        id: 'a2',
        scheduledAt: iso('2099-11-11T12:00:00Z'),
        status: 'COMPLETED',
      },
      {
        id: 'a3',
        scheduledAt: iso('2099-11-18T12:00:00Z'),
        status: 'SCHEDULED',
      },
      {
        id: 'a4',
        scheduledAt: iso('2099-11-25T12:00:00Z'),
        status: 'SCHEDULED',
      },
      {
        id: 'b1',
        scheduledAt: iso('2099-12-09T12:00:00Z'),
        status: 'SCHEDULED',
      },
      {
        id: 'b2',
        scheduledAt: iso('2099-12-16T12:00:00Z'),
        status: 'SCHEDULED',
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
      ...extra,
    });

    beforeEach(() => {
      prisma.enrollment.findFirst.mockResolvedValue(
        enrollment({ firstLessonDate: iso('2099-11-04T00:00:00Z') }),
      );
      prisma.lesson.findMany.mockResolvedValue(lessons);
    });

    it('corta no meio do ciclo 1: mantém fatura atrasada do ciclo 1 e apaga a do ciclo 2', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'a4',
        scheduledAt: iso('2099-11-25T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        payment('p1', '2099-11-04', 'OVERDUE'), // aulas a3 ainda acontecem → fica
        payment('p2', '2099-12-04', 'PENDING'), // todas as aulas removidas → apaga
      ]);

      const result = await service.end('enr-1', schoolId, 'a4');

      expect(prisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['a4', 'b1', 'b2'] } },
      });
      expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['p2'] } },
      });
      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { isActive: false },
      });
      expect(result.lessonsRemoved).toBe(3);
      expect(result.lessonsKept).toBe(3);
      expect(result.paymentsDeleted.map((p) => p.id)).toEqual(['p2']);
    });

    it('corte depois de aulas já realizadas do ciclo 1: a fatura do ciclo 1 fica', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'a3',
        scheduledAt: iso('2099-11-18T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        payment('p1', '2099-11-04', 'PENDING'),
        payment('p2', '2099-12-04', 'PENDING'),
      ]);

      const result = await service.previewEnd('enr-1', schoolId, 'a3');

      // ciclo 1 ainda tem a1 e a2 (já realizadas) → fatura 1 fica
      expect(result.paymentsDeleted.map((p) => p.id)).toEqual(['p2']);
    });

    it('corte na primeira aula: as duas faturas em aberto são apagadas', async () => {
      const allScheduled = lessons.map((l) => ({ ...l, status: 'SCHEDULED' }));
      prisma.lesson.findMany.mockResolvedValue(allScheduled);
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'a1',
        scheduledAt: iso('2099-11-04T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        payment('p1', '2099-11-04', 'OVERDUE'),
        payment('p2', '2099-12-04', 'PENDING'),
      ]);

      const result = await service.previewEnd('enr-1', schoolId, 'a1');

      expect(result.lessonsRemoved).toBe(6);
      expect(result.lessonsKept).toBe(0);
      expect(result.paymentsDeleted.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('fatura paga nunca é apagada, só sinalizada', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'b1',
        scheduledAt: iso('2099-12-09T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        payment('p1', '2099-11-04', 'PAID'),
        payment('p2', '2099-12-04', 'PAID'),
      ]);

      const result = await service.end('enr-1', schoolId, 'b1');

      expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [] } },
      });
      expect(result.paidPaymentsAffected.map((p) => p.id)).toEqual(['p2']);
    });

    it('fatura apagada que estava num pagamento agregado cancela o agregado e solta as outras', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'b1',
        scheduledAt: iso('2099-12-09T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        payment('p2', '2099-12-04', 'PENDING', { paymentBundleId: 'bundle-1' }),
      ]);

      await service.end('enr-1', schoolId, 'b1');

      expect(prisma.paymentBundle.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['bundle-1'] }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { paymentBundleId: { in: ['bundle-1'] } },
        data: { paymentBundleId: null },
      });
    });

    it('fatura avulsa (sem padrão na chave) não é tocada', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        id: 'a3',
        scheduledAt: iso('2099-11-18T12:00:00Z'),
      });
      prisma.payment.findMany.mockResolvedValue([
        {
          ...payment('p9', '2099-12-04', 'PENDING'),
          idempotencyKey: 'manual-1',
        },
      ]);

      const result = await service.previewEnd('enr-1', schoolId, 'a3');
      expect(result.paymentsDeleted).toHaveLength(0);
    });
  });
});
