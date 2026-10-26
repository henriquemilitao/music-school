import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { LessonStatus } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LESSON_NOTES_MAX_LENGTH } from './lessons.constants';

describe('LessonsService.update — anotações da aula', () => {
  const lessonId = 'lesson-1';
  const schoolId = 'school-1';

  const prisma = {
    lesson: { findFirst: jest.fn(), update: jest.fn() },
  };
  let service: LessonsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.lesson.update.mockResolvedValue({ id: lessonId });

    const moduleRef = await Test.createTestingModule({
      providers: [LessonsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(LessonsService);
  });

  function givenLessonWithNotes(notes: string | null) {
    prisma.lesson.findFirst.mockResolvedValue({
      id: lessonId,
      schoolId,
      notes,
      status: LessonStatus.COMPLETED,
    });
  }

  function dataSentToPrisma(): Record<string, unknown> {
    const [args] = prisma.lesson.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    return args.data;
  }

  it('salva o texto e marca a data da edição', async () => {
    givenLessonWithNotes(null);

    await service.update(lessonId, { notes: 'Escala de Dó maior' }, schoolId);

    expect(dataSentToPrisma()).toMatchObject({
      notes: 'Escala de Dó maior',
      notesUpdatedAt: expect.any(Date) as Date,
    });
  });

  it.each([null, ''])('apaga as anotações quando recebe %p', async (value) => {
    givenLessonWithNotes('Texto antigo');

    await service.update(lessonId, { notes: value }, schoolId);

    expect(dataSentToPrisma()).toMatchObject({
      notes: null,
      notesUpdatedAt: null,
    });
  });

  it('não mexe nas anotações quando o campo não vem no body', async () => {
    givenLessonWithNotes('Texto antigo');

    await service.update(
      lessonId,
      { status: LessonStatus.CANCELLED, cancelReason: 'Aluno faltou' },
      schoolId,
    );

    expect(dataSentToPrisma()).not.toHaveProperty('notes');
    expect(dataSentToPrisma()).not.toHaveProperty('notesUpdatedAt');
  });

  it('não muda a data da edição se o texto for o mesmo', async () => {
    givenLessonWithNotes('Mesmo texto');

    await service.update(lessonId, { notes: 'Mesmo texto' }, schoolId);

    expect(dataSentToPrisma()).not.toHaveProperty('notesUpdatedAt');
  });

  it('não encontra aula de outra escola', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);

    await expect(
      service.update(lessonId, { notes: 'x' }, schoolId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.lesson.update).not.toHaveBeenCalled();
  });
});

describe('UpdateLessonDto — validação das anotações', () => {
  // mesma configuração do ValidationPipe global (main.ts)
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const validate = (body: unknown) =>
    pipe.transform(body, {
      type: 'body',
      metatype: UpdateLessonDto,
    }) as Promise<UpdateLessonDto>;

  it('tira espaços e quebras de linha das pontas', async () => {
    const dto = await validate({ notes: '  \nTrabalhamos o ritmo  \n' });
    expect(dto.notes).toBe('Trabalhamos o ritmo');
  });

  it('aceita null (apagar)', async () => {
    const dto = await validate({ notes: null });
    expect(dto.notes).toBeNull();
  });

  it('aceita exatamente o limite de caracteres', async () => {
    const dto = await validate({ notes: 'a'.repeat(LESSON_NOTES_MAX_LENGTH) });
    expect(dto.notes).toHaveLength(LESSON_NOTES_MAX_LENGTH);
  });

  it('recusa texto acima do limite', async () => {
    await expect(
      validate({ notes: 'a'.repeat(LESSON_NOTES_MAX_LENGTH + 1) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa anotação que não é texto', async () => {
    await expect(validate({ notes: 123 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
