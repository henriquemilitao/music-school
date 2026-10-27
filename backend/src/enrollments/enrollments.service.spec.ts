/* eslint-disable @typescript-eslint/no-unsafe-member-access --
   mocks do Prisma: os retornos são objetos de teste, não tipos reais */
import { Test } from '@nestjs/testing';
import { EnrollmentsService } from './enrollments.service';
import { PrismaService } from '../prisma/prisma.service';

// Testa a trava de geração: ao gerar um novo ciclo, só entram aulas
// DEPOIS da última aula regular que a matrícula já tem.
describe('EnrollmentsService.renew — trava de geração de aulas', () => {
  const prisma = {
    enrollment: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    school: { findUniqueOrThrow: jest.fn() },
    lesson: { findFirst: jest.fn(), createMany: jest.fn() },
    payment: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: EnrollmentsService;

  const firstLessonDate = new Date('2099-11-04T00:00:00Z');
  const enrollment = {
    id: 'enr-1',
    schoolId: 'school-1',
    studentId: 'stu-1',
    teacherId: null,
    isActive: true,
    weekDay: firstLessonDate.getUTCDay(),
    startTime: '08:00',
    durationMinutes: 60,
    frequency: 'WEEKLY',
    monthlyAmount: '200.00',
    firstLessonDate,
    lastLessonPeriodStart: firstLessonDate,
    firstPaymentDueDate: new Date('2099-11-04T12:00:00Z'),
    lastPaymentDueDate: new Date('2099-11-04T12:00:00Z'),
    lastGeneratedPeriodKey: '2099-11-04',
  };

  const generatedDates = () =>
    (
      prisma.lesson.createMany.mock.calls[0][0].data as {
        scheduledAt: Date;
      }[]
    ).map((lesson) => lesson.scheduledAt);

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.enrollment.findFirst.mockResolvedValue(enrollment);
    prisma.enrollment.findUniqueOrThrow.mockResolvedValue(enrollment);
    prisma.school.findUniqueOrThrow.mockResolvedValue({
      timezoneOffsetHours: -4,
    });
    prisma.lesson.createMany.mockReturnValue({ op: 'createMany' });
    prisma.payment.upsert.mockReturnValue({ op: 'upsert' });
    prisma.enrollment.update.mockReturnValue({ op: 'update' });
    prisma.$transaction.mockResolvedValue([{}, { id: 'pay-1' }, {}]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        EnrollmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(EnrollmentsService);

    // renew() termina chamando findOne — não é o foco aqui
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'enr-1' } as never);
  });

  it('sem aulas existentes gera o ciclo inteiro', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);

    await service.renew('enr-1', 'school-1');

    expect(generatedDates().length).toBeGreaterThanOrEqual(4);
  });

  it('só gera aulas depois da última aula regular existente', async () => {
    prisma.lesson.findFirst.mockResolvedValueOnce(null);
    await service.renew('enr-1', 'school-1');
    const all = generatedDates();

    // segunda tentativa: já existe aula até a 2ª data do ciclo
    jest.clearAllMocks();
    prisma.lesson.findFirst.mockResolvedValue({ scheduledAt: all[1] });
    prisma.lesson.createMany.mockReturnValue({ op: 'createMany' });
    prisma.enrollment.findFirst.mockResolvedValue(enrollment);
    prisma.enrollment.findUniqueOrThrow.mockResolvedValue(enrollment);
    prisma.school.findUniqueOrThrow.mockResolvedValue({
      timezoneOffsetHours: -4,
    });
    prisma.payment.upsert.mockReturnValue({ op: 'upsert' });
    prisma.enrollment.update.mockReturnValue({ op: 'update' });
    prisma.$transaction.mockResolvedValue([{}, { id: 'pay-1' }, {}]);

    await service.renew('enr-1', 'school-1');

    expect(generatedDates()).toEqual(all.slice(2));
  });

  it('ignora reposições ao procurar a última aula existente', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);

    await service.renew('enr-1', 'school-1');

    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollmentId: 'enr-1', isMakeup: false },
      }),
    );
  });
});
