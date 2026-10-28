import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import {
  BulkDeleteLessonsDto,
  BulkUpdateLessonsDto,
} from './dto/bulk-lessons.dto';
import { LessonStatus, Prisma } from '@prisma/client';
import { calculateAge } from '../common/utils/age.util';
import { getSchoolTimezoneOffset } from '../common/utils/school-timezone.util';
import { shiftLesson } from './lesson-schedule.util';

// Formato do detalhe da aula na visão do admin. O PATCH devolve o mesmo
// formato, assim o app atualiza a tela direto com a resposta do save.
const LESSON_DETAIL_INCLUDE = {
  student: { include: { user: { select: { name: true, email: true } } } },
  teacher: { include: { user: { select: { name: true } } } },
  enrollment: { select: { id: true, weekDay: true, startTime: true } },
} satisfies Prisma.LessonInclude;

// Quando o status muda, o motivo do cancelamento acompanha: sair de
// CANCELLED apaga o motivo; em CANCELLED o motivo é opcional (e só muda se
// vier no body).
function resolveStatusChange(
  current: LessonStatus,
  status?: LessonStatus,
  cancelReason?: string | null,
): Pick<Prisma.LessonUncheckedUpdateInput, 'status' | 'cancelReason'> {
  const next = status ?? current;
  if (next === LessonStatus.CANCELLED) {
    return {
      status,
      cancelReason:
        cancelReason === undefined ? undefined : cancelReason || null,
    };
  }
  return {
    status,
    cancelReason: status !== undefined && status !== current ? null : undefined,
  };
}

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: cria aula avulsa ──────────────────────────────────────────
  async create(dto: CreateLessonDto, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    if (dto.teacherId) await this.assertTeacher(dto.teacherId, schoolId);

    if (dto.enrollmentId) {
      const enrollment = await this.prisma.enrollment.findFirst({
        where: { id: dto.enrollmentId, studentId: dto.studentId, schoolId },
        select: { id: true },
      });
      if (!enrollment) {
        throw new BadRequestException('Matrícula não pertence a este aluno');
      }
    }

    return this.prisma.lesson.create({
      data: {
        schoolId,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        enrollmentId: dto.enrollmentId,
        instrument: dto.instrument,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 60,
        isMakeup: dto.isMakeup ?? false,
        notes: dto.notes || null,
        notesUpdatedAt: dto.notes ? new Date() : null,
        status: LessonStatus.SCHEDULED,
      },
      include: LESSON_DETAIL_INCLUDE,
    });
  }

  // ─── Admin: busca aula por id ─────────────────────────────────────────
  async findOne(lessonId: string, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      include: LESSON_DETAIL_INCLUDE,
    });
    if (!lesson) throw new NotFoundException('Aula não encontrada');
    return lesson;
  }

  // ─── Admin: lista aulas da escola por mês ────────────────────────────
  async findByMonth(month: string, schoolId: string) {
    // month no formato "2026-07"
    const [year, mon] = month.split('-').map(Number) as [number, number];
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    return this.prisma.lesson.findMany({
      where: {
        schoolId,
        scheduledAt: { gte: start, lt: end },
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ─── Admin: lista aulas da escola em um dia específico ────────────────
  // Recebe os limites já em UTC/ISO, calculados pelo cliente no seu
  // próprio fuso local — o backend não sabe (nem precisa saber) de
  // fuso horário, só compara instantes UTC contra o scheduledAt.
  async findByDay(startIso: string, endIso: string, schoolId: string) {
    const start = new Date(startIso);
    const end = new Date(endIso);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Parâmetros de data inválidos');
    }

    return this.prisma.lesson.findMany({
      where: {
        schoolId,
        scheduledAt: { gte: start, lt: end },
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // ─── Admin: edita a aula (qualquer campo, todos opcionais) ───────────
  async update(lessonId: string, dto: UpdateLessonDto, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
    });
    if (!lesson) throw new NotFoundException('Aula não encontrada');

    if (dto.teacherId) await this.assertTeacher(dto.teacherId, schoolId);

    // Anotações: undefined = não veio no body (não mexe); "" ou null =
    // apagar. O DTO já faz o trim. notesUpdatedAt só muda quando o texto
    // muda de verdade — salvar o mesmo texto de novo não "atualiza" a data
    // que o aluno vê.
    const nextNotes = dto.notes === undefined ? undefined : dto.notes || null;
    const notesChanged = nextNotes !== undefined && nextNotes !== lesson.notes;

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...resolveStatusChange(lesson.status, dto.status, dto.cancelReason),
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        durationMinutes: dto.durationMinutes,
        teacherId: dto.teacherId,
        instrument: dto.instrument,
        ...(notesChanged
          ? { notes: nextNotes, notesUpdatedAt: nextNotes ? new Date() : null }
          : {}),
      },
      include: LESSON_DETAIL_INCLUDE,
    });
  }

  // ─── Admin: exclui a aula (some do histórico) ────────────────────────
  async remove(lessonId: string, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Aula não encontrada');

    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { id: lessonId };
  }

  // ─── Admin: edita várias aulas de uma vez ────────────────────────────
  // Todas as aulas recebem as mesmas alterações. Dia e horário são
  // relativos: "+2 dias" leva cada aula pra 2 dias depois da sua data, e o
  // horário novo vale (na hora da escola) pra todas.
  async bulkUpdate(dto: BulkUpdateLessonsDto, schoolId: string) {
    const { lessonIds, changes } = dto;
    if (Object.values(changes).every((value) => value === undefined)) {
      throw new BadRequestException('Escolha pelo menos uma alteração');
    }

    const lessons = await this.findOwnedLessons(lessonIds, schoolId);
    if (changes.teacherId)
      await this.assertTeacher(changes.teacherId, schoolId);

    const movesSchedule =
      changes.shiftDays !== undefined || changes.startTime !== undefined;
    const offset = movesSchedule
      ? await getSchoolTimezoneOffset(this.prisma, schoolId)
      : 0;

    await this.prisma.$transaction(
      lessons.map((lesson) =>
        this.prisma.lesson.update({
          where: { id: lesson.id },
          data: {
            ...resolveStatusChange(
              lesson.status,
              changes.status,
              changes.cancelReason,
            ),
            teacherId: changes.teacherId,
            instrument: changes.instrument,
            durationMinutes: changes.durationMinutes,
            scheduledAt: movesSchedule
              ? shiftLesson(lesson.scheduledAt, changes, offset)
              : undefined,
          },
          select: { id: true },
        }),
      ),
    );

    return { updatedCount: lessons.length };
  }

  // ─── Admin: exclui várias aulas de uma vez ───────────────────────────
  async bulkDelete(dto: BulkDeleteLessonsDto, schoolId: string) {
    await this.findOwnedLessons(dto.lessonIds, schoolId);
    const { count } = await this.prisma.lesson.deleteMany({
      where: { id: { in: dto.lessonIds }, schoolId },
    });
    return { deletedCount: count };
  }

  // Todas as aulas precisam existir e ser desta escola — senão nada é feito
  private async findOwnedLessons(lessonIds: string[], schoolId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds }, schoolId },
      select: { id: true, scheduledAt: true, status: true },
    });
    if (lessons.length !== lessonIds.length) {
      throw new NotFoundException('Alguma das aulas não foi encontrada');
    }
    return lessons;
  }

  private async assertTeacher(teacherId: string, schoolId: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, user: { schoolId } },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Professor não encontrado');
  }

  // ─── Aluno: lista aulas dos seus students ────────────────────────────
  async findMyLessons(
    userId: string,
    studentId?: string,
    status?: LessonStatus,
  ) {
    // busca os students do usuário logado
    const students = await this.prisma.student.findMany({
      where: {
        userId,
        // se passou studentId, filtra só aquele
        ...(studentId ? { id: studentId } : {}),
      },
      select: { id: true },
    });

    if (!students.length) return [];

    // garante que o studentId passado pertence ao usuário
    if (studentId && !students.find((s) => s.id === studentId)) {
      throw new ForbiddenException('Acesso negado');
    }

    const studentIds = students.map((s) => s.id);

    return this.prisma.lesson.findMany({
      where: {
        studentId: { in: studentIds },
        ...(status ? { status } : {}),
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: {
        scheduledAt: status === LessonStatus.COMPLETED ? 'desc' : 'asc',
      },
    });
  }

  // ─── Aluno: detalhe de uma aula específica ────────────────────────────
  async findMyLessonById(userId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        student: { include: { user: { select: { name: true } } } },
      },
    });

    if (!lesson) throw new NotFoundException('Aula não encontrada');

    // garante que essa aula pertence a um student do usuário logado
    const belongsToUser = await this.prisma.student.findFirst({
      where: { id: lesson.studentId, userId },
    });

    if (!belongsToUser) {
      throw new ForbiddenException('Acesso negado');
    }

    return lesson;
  }

  // Busca as aulas de um aluno específico
  async findLessonsByStudent(
    schoolId: string,
    studentId: string,
    status?: LessonStatus,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    return this.prisma.lesson.findMany({
      where: {
        studentId,
        ...(status ? { status } : {}),
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: {
        scheduledAt: status === LessonStatus.COMPLETED ? 'desc' : 'asc',
      },
    });
  }

  // ─── Aluno: dashboard ────────────────────────────────────────────────
  async getDashboard(userId: string) {
    const students = await this.prisma.student.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        birthDate: true,
        instrument: true,
      },
    });

    if (!students.length) return [];

    const now = new Date();

    const dashboard = await Promise.all(
      students.map(async (student) => {
        const RECENTLY_FINISHED_GRACE_MINUTES = 30; // quanto tempo depois do fim ainda mostra como "acabou de terminar"

        const lookbackFrom = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3h de folga generosa pra cobrir qualquer duração + grace period

        const candidates = await this.prisma.lesson.findMany({
          where: {
            studentId: student.id,
            status: LessonStatus.SCHEDULED,
            scheduledAt: { gte: lookbackFrom },
          },
          orderBy: { scheduledAt: 'asc' },
          include: {
            teacher: { include: { user: { select: { name: true } } } },
          },
        });

        const nextLesson =
          candidates.find((l) => {
            const end = new Date(
              l.scheduledAt.getTime() + l.durationMinutes * 60_000,
            );
            const graceEnd = new Date(
              end.getTime() + RECENTLY_FINISHED_GRACE_MINUTES * 60_000,
            );
            return graceEnd > now; // ainda não passou do período de graça
          }) ?? null;

        const lastLesson = await this.prisma.lesson.findFirst({
          where: {
            studentId: student.id,
            status: LessonStatus.COMPLETED,
          },
          orderBy: { scheduledAt: 'desc' },
          include: {
            teacher: { include: { user: { select: { name: true } } } },
          },
        });

        // Todas as faturas em aberto (PENDING ou OVERDUE) do aluno,
        // da mais antiga (mais urgente) pra mais nova. Antes era
        // findFirst de "a fatura vigente", mas isso escondia o caso
        // de duas faturas em aberto ao mesmo tempo (ex: aluno que
        // atrasou tanto que já entrou o mês seguinte).
        const openPayments = await this.prisma.payment.findMany({
          where: {
            studentId: student.id,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            referenceMonth: true,
            amount: true,
            status: true,
            dueDate: true,
            paidAt: true,
            pixCopyPaste: true,
            pixQrCode: true,
          },
        });

        return {
          student: {
            id: student.id,
            name: student.name,
            age: calculateAge(student.birthDate),
            instrument: student.instrument,
          },
          nextLesson,
          lastLesson,
          openPayments,
        };
      }),
    );

    return dashboard;
  }

  async markCompletedLessons() {
    const now = new Date();

    const candidates = await this.prisma.lesson.findMany({
      where: {
        status: LessonStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      select: { id: true, scheduledAt: true, durationMinutes: true },
    });

    const toComplete = candidates.filter((lesson) => {
      const endsAt = new Date(
        lesson.scheduledAt.getTime() + lesson.durationMinutes * 60_000,
      );
      return endsAt <= now;
    });

    if (toComplete.length === 0) {
      return { updatedCount: 0 };
    }

    await this.prisma.lesson.updateMany({
      where: { id: { in: toComplete.map((l) => l.id) } },
      data: { status: LessonStatus.COMPLETED },
    });

    return { updatedCount: toComplete.length };
  }
}
