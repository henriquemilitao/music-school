import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { LessonStatus } from '@prisma/client';
import { calculateAge } from 'src/common/utils/age.util';

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: cria aula avulsa ou de reposição ──────────────────────────
  async create(dto: CreateLessonDto, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, user: { schoolId } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    return this.prisma.lesson.create({
      data: {
        schoolId,
        studentId: dto.studentId,
        teacherId: dto.teacherId,
        enrollmentId: dto.enrollmentId,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 60,
        isMakeup: dto.isMakeup ?? false,
        notes: dto.notes,
        status: LessonStatus.SCHEDULED,
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    });
  }

  // ─── Admin: busca aula por id ─────────────────────────────────────────
  async findOne(lessonId: string, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
        enrollment: { select: { id: true, weekDay: true, startTime: true } },
      },
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
  async findByDay(day: string, schoolId: string) {
    // day no formato "2026-08-03"
    const [year, month, date] = day.split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const start = new Date(year, month - 1, date);
    const end = new Date(year, month - 1, date + 1);

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

  // ─── Admin: atualiza status/notas/cancelamento ────────────────────────
  async update(lessonId: string, dto: UpdateLessonDto, schoolId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, schoolId },
    });
    if (!lesson) throw new NotFoundException('Aula não encontrada');

    // se está cancelando, exige motivo
    if (dto.status === LessonStatus.CANCELLED && !dto.cancelReason) {
      throw new BadRequestException('Informe o motivo do cancelamento');
    }

    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        status: dto.status,
        notes: dto.notes,
        cancelReason: dto.cancelReason,
      },
      include: {
        student: { include: { user: { select: { name: true } } } },
        teacher: { include: { user: { select: { name: true } } } },
      },
    });
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
