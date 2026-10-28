import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { LessonStatus } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { BulkUpdateLessonsDto } from './dto/bulk-lessons.dto';
import { CancelLessonDto } from './dto/cancel-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';

const schoolId = 'school-1';
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const L1 = uuid(1);
const L2 = uuid(2);
const TEACHER = uuid(10);

describe('LessonsService — edição pelo admin', () => {
  const tx = {
    lesson: {
      update: jest.fn(),
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const prisma = {
    student: { findFirst: jest.fn() },
    teacher: { findFirst: jest.fn() },
    enrollment: { findFirst: jest.fn() },
    school: { findUniqueOrThrow: jest.fn() },
    lesson: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: LessonsService;

  const baseLesson = {
    id: L1,
    schoolId,
    studentId: 'stu-1',
    teacherId: TEACHER,
    enrollmentId: 'enr-1',
    instrument: null,
    scheduledAt: new Date('2026-11-02T19:00:00Z'),
    durationMinutes: 60,
    status: LessonStatus.SCHEDULED,
    notes: null,
    cancelReason: null,
  };

  const dataOf = (call: jest.Mock['mock']['calls'][number]) =>
    (call[0] as { data: Record<string, unknown> }).data;

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.lesson.findFirst.mockResolvedValue(baseLesson);
    prisma.lesson.update.mockImplementation((args: unknown) => args);
    prisma.teacher.findFirst.mockResolvedValue({ id: TEACHER });
    prisma.school.findUniqueOrThrow.mockResolvedValue({
      timezoneOffsetHours: -4,
    });
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (client: typeof tx) => unknown)(tx)
        : Promise.all(arg as unknown[]),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [LessonsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LessonsService);
  });

  describe('update', () => {
    it('edita data, duração, professor e instrumento de uma vez', async () => {
      await service.update(
        L1,
        {
          scheduledAt: '2026-11-04T19:00:00.000Z',
          durationMinutes: 45,
          teacherId: TEACHER,
          instrument: 'PIANO',
        },
        schoolId,
      );

      const data = dataOf(prisma.lesson.update.mock.calls[0]);
      expect(data).toMatchObject({
        scheduledAt: new Date('2026-11-04T19:00:00.000Z'),
        durationMinutes: 45,
        teacherId: TEACHER,
        instrument: 'PIANO',
      });
    });

    it('recusa professor de outra escola', async () => {
      prisma.teacher.findFirst.mockResolvedValue(null);
      await expect(
        service.update(L1, { teacherId: TEACHER }, schoolId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.lesson.update).not.toHaveBeenCalled();
    });

    it('aceita null: tira o professor e volta o instrumento a seguir o do aluno', async () => {
      await service.update(L1, { teacherId: null, instrument: null }, schoolId);
      expect(dataOf(prisma.lesson.update.mock.calls[0])).toMatchObject({
        teacherId: null,
        instrument: null,
      });
    });

    it('cancelar não exige motivo', async () => {
      await service.update(L1, { status: LessonStatus.CANCELLED }, schoolId);
      const data = dataOf(prisma.lesson.update.mock.calls[0]);
      expect(data.status).toBe(LessonStatus.CANCELLED);
      expect(data.cancelReason).toBeUndefined();
    });

    it('guarda o motivo ao cancelar e o apaga ao sair de cancelada', async () => {
      await service.update(
        L1,
        { status: LessonStatus.CANCELLED, cancelReason: ' Aluno doente ' },
        schoolId,
      );
      expect(dataOf(prisma.lesson.update.mock.calls[0]).cancelReason).toBe(
        ' Aluno doente ',
      );

      prisma.lesson.update.mockClear();
      prisma.lesson.findFirst.mockResolvedValue({
        ...baseLesson,
        status: LessonStatus.CANCELLED,
        cancelReason: 'Aluno doente',
      });
      await service.update(L1, { status: LessonStatus.SCHEDULED }, schoolId);
      expect(dataOf(prisma.lesson.update.mock.calls[0])).toMatchObject({
        status: LessonStatus.SCHEDULED,
        cancelReason: null,
      });
    });

    describe('reposição', () => {
      it('apontar pra uma aula do mesmo aluno marca como reposição', async () => {
        prisma.lesson.findFirst
          .mockResolvedValueOnce(baseLesson) // a aula editada
          .mockResolvedValueOnce({ id: L2 }); // a aula reposta
        await service.update(L1, { makeupForLessonId: L2 }, schoolId);

        expect(prisma.lesson.findFirst).toHaveBeenLastCalledWith({
          where: { id: L2, studentId: 'stu-1', schoolId },
          select: { id: true },
        });
        expect(dataOf(prisma.lesson.update.mock.calls[0])).toMatchObject({
          isMakeup: true,
          makeupForLessonId: L2,
        });
      });

      it('recusa repor aula de outro aluno ou a própria aula', async () => {
        prisma.lesson.findFirst
          .mockResolvedValueOnce(baseLesson)
          .mockResolvedValueOnce(null);
        await expect(
          service.update(L1, { makeupForLessonId: L2 }, schoolId),
        ).rejects.toBeInstanceOf(BadRequestException);

        prisma.lesson.findFirst.mockResolvedValue(baseLesson);
        await expect(
          service.update(L1, { makeupForLessonId: L1 }, schoolId),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(prisma.lesson.update).not.toHaveBeenCalled();
      });

      it('desmarcar reposição desfaz o vínculo', async () => {
        await service.update(L1, { isMakeup: false }, schoolId);
        expect(dataOf(prisma.lesson.update.mock.calls[0])).toMatchObject({
          isMakeup: false,
          makeupForLessonId: null,
        });
      });

      it('não aceita "não é reposição" junto com "repõe outra aula"', async () => {
        await expect(
          service.update(
            L1,
            { isMakeup: false, makeupForLessonId: L2 },
            schoolId,
          ),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
      prisma.lesson.create.mockImplementation((args: unknown) => args);
    });

    it('cria a aula com instrumento, professor e vínculo de reposição', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      prisma.lesson.findFirst.mockResolvedValue({ id: L2 });

      await service.create(
        {
          studentId: 'stu-1',
          enrollmentId: 'enr-1',
          teacherId: TEACHER,
          instrument: 'VIOLAO',
          scheduledAt: '2026-11-04T19:00:00.000Z',
          makeupForLessonId: L2,
        },
        schoolId,
      );

      expect(dataOf(prisma.lesson.create.mock.calls[0])).toMatchObject({
        studentId: 'stu-1',
        enrollmentId: 'enr-1',
        instrument: 'VIOLAO',
        isMakeup: true,
        makeupForLessonId: L2,
        durationMinutes: 60,
        status: LessonStatus.SCHEDULED,
      });
    });

    it('aula extra comum não é reposição', async () => {
      await service.create(
        { studentId: 'stu-1', scheduledAt: '2026-11-04T19:00:00.000Z' },
        schoolId,
      );
      expect(dataOf(prisma.lesson.create.mock.calls[0])).toMatchObject({
        isMakeup: false,
      });
    });

    it('recusa matrícula que não é do aluno', async () => {
      prisma.enrollment.findFirst.mockResolvedValue(null);
      await expect(
        service.create(
          {
            studentId: 'stu-1',
            enrollmentId: 'enr-x',
            scheduledAt: '2026-11-04T19:00:00.000Z',
          },
          schoolId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.lesson.create).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      tx.lesson.update.mockResolvedValue({});
      tx.lesson.create.mockImplementation((args: unknown) =>
        Promise.resolve({ id: 'makeup-1', ...(args as { data: object }).data }),
      );
      tx.lesson.findUniqueOrThrow.mockResolvedValue({
        id: L1,
        status: LessonStatus.CANCELLED,
      });
    });

    it('cancela sem reposição (sem criar nada)', async () => {
      const result = await service.cancel(
        L1,
        { cancelReason: 'Feriado' },
        schoolId,
      );

      expect(tx.lesson.update).toHaveBeenCalledWith({
        where: { id: L1 },
        data: { status: LessonStatus.CANCELLED, cancelReason: 'Feriado' },
      });
      expect(tx.lesson.create).not.toHaveBeenCalled();
      expect(result.makeup).toBeNull();
    });

    it('cancela e cria a reposição herdando professor, duração e matrícula', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        ...baseLesson,
        instrument: 'PIANO',
        durationMinutes: 45,
      });

      const result = await service.cancel(
        L1,
        { makeup: { scheduledAt: '2026-11-09T19:00:00.000Z' } },
        schoolId,
      );

      expect(tx.lesson.create.mock.calls[0]).toBeDefined();
      expect(dataOf(tx.lesson.create.mock.calls[0])).toMatchObject({
        studentId: 'stu-1',
        enrollmentId: 'enr-1',
        teacherId: TEACHER,
        instrument: 'PIANO',
        durationMinutes: 45,
        scheduledAt: new Date('2026-11-09T19:00:00.000Z'),
        isMakeup: true,
        makeupForLessonId: L1,
        status: LessonStatus.SCHEDULED,
      });
      expect(result.makeup).toMatchObject({ id: 'makeup-1' });
    });

    it('a reposição pode ter professor, duração e instrumento diferentes', async () => {
      await service.cancel(
        L1,
        {
          makeup: {
            scheduledAt: '2026-11-09T19:00:00.000Z',
            durationMinutes: 30,
            instrument: 'BAIXO',
          },
        },
        schoolId,
      );
      expect(dataOf(tx.lesson.create.mock.calls[0])).toMatchObject({
        durationMinutes: 30,
        instrument: 'BAIXO',
      });
    });

    it('não cancela de novo uma aula já cancelada', async () => {
      prisma.lesson.findFirst.mockResolvedValue({
        ...baseLesson,
        status: LessonStatus.CANCELLED,
      });
      await expect(service.cancel(L1, {}, schoolId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('exclui a aula', async () => {
      prisma.lesson.findFirst.mockResolvedValue({ id: L1 });
      await expect(service.remove(L1, schoolId)).resolves.toEqual({ id: L1 });
      expect(prisma.lesson.delete).toHaveBeenCalledWith({ where: { id: L1 } });
    });

    it('não exclui aula de outra escola', async () => {
      prisma.lesson.findFirst.mockResolvedValue(null);
      await expect(service.remove(L1, schoolId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.lesson.delete).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdate', () => {
    const lessons = [
      {
        id: L1,
        status: LessonStatus.SCHEDULED,
        scheduledAt: new Date('2026-11-02T19:00:00Z'), // seg 15:00 local
      },
      {
        id: L2,
        status: LessonStatus.SCHEDULED,
        scheduledAt: new Date('2026-11-09T19:00:00Z'), // seg 15:00 local
      },
    ];
    beforeEach(() => prisma.lesson.findMany.mockResolvedValue(lessons));

    it('passa todas as aulas pra 2 dias depois, no novo horário', async () => {
      const result = await service.bulkUpdate(
        {
          lessonIds: [L1, L2],
          changes: { shiftDays: 2, startTime: '16:30' },
        },
        schoolId,
      );

      const sent = prisma.lesson.update.mock.calls.map((call) => dataOf(call));
      expect(sent[0].scheduledAt).toEqual(new Date('2026-11-04T20:30:00Z'));
      expect(sent[1].scheduledAt).toEqual(new Date('2026-11-11T20:30:00Z'));
      expect(result).toEqual({ updatedCount: 2 });
    });

    it('muda status, professor, instrumento e duração sem mexer na data', async () => {
      await service.bulkUpdate(
        {
          lessonIds: [L1, L2],
          changes: {
            status: LessonStatus.COMPLETED,
            teacherId: TEACHER,
            instrument: 'GUITARRA',
            durationMinutes: 45,
          },
        },
        schoolId,
      );

      const data = dataOf(prisma.lesson.update.mock.calls[0]);
      expect(data).toMatchObject({
        status: LessonStatus.COMPLETED,
        teacherId: TEACHER,
        instrument: 'GUITARRA',
        durationMinutes: 45,
      });
      expect(data.scheduledAt).toBeUndefined();
      expect(prisma.school.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('cancelar em lote guarda o motivo opcional', async () => {
      await service.bulkUpdate(
        {
          lessonIds: [L1, L2],
          changes: { status: LessonStatus.CANCELLED, cancelReason: 'Recesso' },
        },
        schoolId,
      );
      expect(dataOf(prisma.lesson.update.mock.calls[0])).toMatchObject({
        status: LessonStatus.CANCELLED,
        cancelReason: 'Recesso',
      });
    });

    it('recusa pedido sem nenhuma alteração', async () => {
      await expect(
        service.bulkUpdate({ lessonIds: [L1], changes: {} }, schoolId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('não faz nada se alguma aula não for desta escola', async () => {
      prisma.lesson.findMany.mockResolvedValue([lessons[0]]);
      await expect(
        service.bulkUpdate(
          { lessonIds: [L1, L2], changes: { durationMinutes: 45 } },
          schoolId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('bulkDelete', () => {
    it('exclui as aulas escolhidas', async () => {
      prisma.lesson.findMany.mockResolvedValue([{ id: L1 }, { id: L2 }]);
      prisma.lesson.deleteMany.mockResolvedValue({ count: 2 });

      await expect(
        service.bulkDelete({ lessonIds: [L1, L2] }, schoolId),
      ).resolves.toEqual({ deletedCount: 2 });
      expect(prisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [L1, L2] }, schoolId },
      });
    });

    it('não exclui nada se alguma aula não for da escola', async () => {
      prisma.lesson.findMany.mockResolvedValue([{ id: L1 }]);
      await expect(
        service.bulkDelete({ lessonIds: [L1, L2] }, schoolId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.lesson.deleteMany).not.toHaveBeenCalled();
    });
  });
});

describe('DTOs de edição de aulas — validação', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = <T>(metatype: new () => T, body: unknown) =>
    pipe.transform(body, { type: 'body', metatype }) as Promise<T>;

  it('PATCH aceita só o que muda, inclusive null pra limpar', async () => {
    const dto = await validate(UpdateLessonDto, {
      teacherId: null,
      instrument: null,
      durationMinutes: 45,
    });
    expect(dto.teacherId).toBeNull();
    expect(dto.instrument).toBeNull();
  });

  it.each([
    [{ durationMinutes: 5 }],
    [{ durationMinutes: 600 }],
    [{ instrument: 'TUBA' }],
    [{ scheduledAt: 'amanhã' }],
    [{ teacherId: 'nao-uuid' }],
    [{ campoQueNaoExiste: 1 }],
  ])('PATCH recusa %j', async (body) => {
    await expect(validate(UpdateLessonDto, body)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('cancelamento aceita reposição aninhada e valida os campos dela', async () => {
    const ok = await validate(CancelLessonDto, {
      cancelReason: 'Feriado',
      makeup: { scheduledAt: '2026-11-09T19:00:00.000Z', durationMinutes: 45 },
    });
    expect(ok.makeup?.durationMinutes).toBe(45);

    await expect(
      validate(CancelLessonDto, { makeup: { scheduledAt: 'x' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('lote', () => {
    const ids = [L1, L2];

    it('aceita dias e horário', async () => {
      const dto = await validate(BulkUpdateLessonsDto, {
        lessonIds: ids,
        changes: { shiftDays: -2, startTime: '09:05' },
      });
      expect(dto.changes.shiftDays).toBe(-2);
    });

    it.each([
      [{ lessonIds: [], changes: { shiftDays: 1 } }],
      [{ lessonIds: ['x'], changes: { shiftDays: 1 } }],
      [{ lessonIds: [L1, L1], changes: { shiftDays: 1 } }],
      [{ lessonIds: ids, changes: { shiftDays: 1.5 } }],
      [{ lessonIds: ids, changes: { shiftDays: 400 } }],
      [{ lessonIds: ids, changes: { startTime: '25:00' } }],
      [{ lessonIds: ids, changes: { startTime: '9:00' } }],
      [{ lessonIds: ids }],
    ])('recusa %j', async (body) => {
      await expect(validate(BulkUpdateLessonsDto, body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
