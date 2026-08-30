import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateFullUserDto } from './dto/create-full-user.dto';
import { Role, Student } from '@prisma/client';
import { calculateAge } from '../common/utils/age.util';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  async create(dto: CreateUserDto, schoolId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    // sem senha na criação — a pessoa define via link de convite
    const user = await this.prisma.user.create({
      data: {
        schoolId,
        name: dto.name,
        email: dto.email,
        passwordHash: null,
        phone: dto.phone,
        role: dto.role ?? Role.STUDENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (user.role === Role.TEACHER) {
      await this.prisma.teacher.create({
        data: { userId: user.id },
      });
    }

    const inviteLink = await this.authService.createInvite(user.id);

    return { ...user, inviteLink };
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        students: {
          select: {
            id: true,
            name: true,
            birthDate: true,
            instrument: true,
            notes: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado');

    const studentsWithAge = user.students.map((s) => ({
      ...s,
      age: calculateAge(s.birthDate),
    }));

    return { ...user, students: studentsWithAge };
  }

  async updatePushToken(userId: string, pushToken: string) {
    await this.prisma.user.updateMany({
      where: {
        pushToken,
        id: { not: userId },
      },
      data: { pushToken: null },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
    return { status: 'ok' };
  }

  async findAllBySchool(schoolId: string) {
    return this.prisma.user.findMany({
      where: { schoolId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─────────────────────────────────────────────
  // CRIAÇÃO COMPLETA — user + aluno(s) + matrícula(s) de uma vez
  // ─────────────────────────────────────────────
  async createFull(dto: CreateFullUserDto, schoolId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    // 1. cria o User titular (sem senha — mesmo fluxo de convite de sempre)
    const user = await this.prisma.user.create({
      data: {
        schoolId,
        name: dto.name,
        email: dto.email,
        passwordHash: null,
        phone: dto.phone,
        role: dto.role ?? Role.STUDENT,
      },
    });

    // tipagem explícita — em vez de deixar o TS inferir never[]
    const createdStudents: Array<{
      student: Student;
      enrollment: Awaited<ReturnType<EnrollmentsService['create']>>;
    }> = [];

    // 2. cria cada Student vinculado a esse User
    for (const studentDto of dto.students) {
      const student = await this.prisma.student.create({
        data: {
          userId: user.id,
          name: studentDto.name,
          birthDate: studentDto.birthDate
            ? new Date(studentDto.birthDate)
            : undefined,
          instrument: studentDto.instrument,
          notes: studentDto.notes,
        },
      });

      // 3. reaproveita o EnrollmentsService já existente — mesma
      // lógica de gerar Lessons + Payment do primeiro período,
      // idempotência, cálculo de weekDay a partir do startDate, etc.
      // dentro de createFull(), no loop "for (const studentDto of dto.students)"

      const enrollment = await this.enrollmentsService.create(
        {
          studentId: student.id,
          teacherId: studentDto.enrollment.teacherId,
          startTime: studentDto.enrollment.startTime,
          durationMinutes: studentDto.enrollment.durationMinutes,
          monthlyAmount: studentDto.enrollment.monthlyAmount,
          // Renomeado de startDate — mesma ideia de antes, só nome mais
          // claro (é a data da aula, não do pagamento).
          firstLessonDate: studentDto.enrollment.firstLessonDate,
          // NOVO — repassa o vencimento customizado, se o admin informou
          // um na hora de cadastrar esse aluno específico. Se vier
          // undefined, o EnrollmentsService.create aplica o default
          // (mesma data de firstLessonDate) — não precisamos resolver
          // esse default aqui, ele já é tratado lá dentro.
          firstPaymentDueDate: studentDto.enrollment.firstPaymentDueDate,
          // NOVO — mesma ideia: repassa o rótulo manual se veio, senão
          // undefined e o default (mês do vencimento) é calculado lá
          // dentro do EnrollmentsService.create.
          referenceMonth: studentDto.enrollment.referenceMonth,
          firstPaymentPaid: studentDto.enrollment.firstPaymentPaid,
        },
        schoolId,
      );

      createdStudents.push({ student, enrollment });
    }

    // 4. gera o link de convite, igual o create() simples já faz
    const inviteLink = await this.authService.createInvite(user.id);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      students: createdStudents,
      inviteLink,
    };
  }
}
