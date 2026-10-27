import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
import { Prisma, Role } from '@prisma/client';
import { calculateAge } from '../common/utils/age.util'; // ajuste o path relativo conforme sua estrutura

// Compara nomes ignorando maiúsculas, acentos e espaços duplicados
function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

interface RequestingUser {
  id: string;
  role: Role;
  schoolId: string;
}

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  private withAge<T extends { birthDate: Date | null }>(student: T) {
    return { ...student, age: calculateAge(student.birthDate) };
  }

  // Aluno "ativo" = tem pelo menos uma matrícula ativa. Quem teve a matrícula
  // encerrada (ou nunca teve) aparece como inativo — não há campo próprio no
  // banco, a situação é derivada das matrículas.
  private withActivity<T extends { enrollments: { isActive: boolean }[] }>(
    student: T,
  ) {
    const { enrollments, ...rest } = student;
    return { ...rest, isActive: enrollments.some((e) => e.isActive) };
  }

  async findMe(userId: string) {
    const students = await this.prisma.student.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        birthDate: true,
        instrument: true,
        notes: true,
        createdAt: true,
      },
    });

    return students.map((s) => this.withAge(s));
  }

  async findOne(studentId: string, schoolId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { schoolId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            isActive: true,
          },
        },
        enrollments: { select: { isActive: true } },
      },
    });

    if (!student) throw new NotFoundException('Aluno não encontrado');

    return this.withAge(this.withActivity(student));
  }

  async findAllBySchool(schoolId: string) {
    const students = await this.prisma.student.findMany({
      where: { user: { schoolId, isActive: true } },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
        enrollments: { select: { isActive: true } },
      },
      orderBy: { name: 'asc' },
    });

    return students.map((s) => this.withAge(this.withActivity(s)));
  }

  async create(dto: CreateStudentDto, schoolId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, schoolId },
    });

    if (!user) {
      throw new NotFoundException(
        'Usuário não encontrado ou não pertence a esta escola',
      );
    }

    const student = await this.prisma.student.create({
      data: {
        userId: dto.userId,
        name: dto.name,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        instrument: dto.instrument,
        notes: dto.notes,
      },
      select: {
        id: true,
        name: true,
        birthDate: true,
        instrument: true,
        notes: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return this.withAge(student);
  }

  async update(
    studentId: string,
    dto: UpdateStudentDto,
    requestingUser: RequestingUser,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true } } },
    });

    if (!student) throw new NotFoundException('Aluno não encontrado');

    if (
      student.user.id !== requestingUser.id &&
      requestingUser.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('Acesso negado');
    }

    const updated = await this.prisma.student.update({
      where: { id: studentId },
      data: dto,
      select: {
        id: true,
        name: true,
        birthDate: true,
        instrument: true,
        notes: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return this.withAge(updated);
  }

  // ─── Dados cadastrais (admin): aluno + responsável ─────────────────

  async updateProfile(
    studentId: string,
    dto: UpdateStudentProfileDto,
    schoolId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { schoolId } },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    const newEmail = dto.guardianEmail?.trim();
    if (
      newEmail &&
      newEmail.toLowerCase() !== student.user.email.toLowerCase()
    ) {
      const taken = await this.prisma.user.findFirst({
        where: {
          email: { equals: newEmail, mode: 'insensitive' },
          NOT: { id: student.user.id },
        },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException('Já existe um usuário com esse e-mail');
      }
    }

    const studentData: Prisma.StudentUpdateInput = {};
    if (dto.name !== undefined) studentData.name = dto.name.trim();
    if (dto.birthDate !== undefined)
      studentData.birthDate = new Date(dto.birthDate);
    if (dto.notes !== undefined) studentData.notes = dto.notes;

    const userData: Prisma.UserUpdateInput = {};
    if (dto.guardianName !== undefined) userData.name = dto.guardianName.trim();
    if (newEmail) userData.email = newEmail;
    if (dto.guardianPhone !== undefined)
      userData.phone = dto.guardianPhone.trim() || null;

    const operations: Prisma.PrismaPromise<unknown>[] = [];
    if (Object.keys(studentData).length > 0) {
      operations.push(
        this.prisma.student.update({
          where: { id: studentId },
          data: studentData,
        }),
      );
    }
    if (Object.keys(userData).length > 0) {
      operations.push(
        this.prisma.user.update({
          where: { id: student.user.id },
          data: userData,
        }),
      );
    }
    if (operations.length > 0) await this.prisma.$transaction(operations);

    return this.findOne(studentId, schoolId);
  }

  // ─── Excluir TUDO (definitivo) ──────────────────────────────────────
  //
  // Apaga aulas, faturas, matrículas e o aluno. Se o responsável não tem
  // mais nenhum aluno (e é uma conta de aluno/responsável), a conta dele
  // também é removida — o e-mail fica livre pra um novo cadastro. Exige o
  // nome completo do aluno como confirmação (conferido aqui, no servidor).
  async deletePermanently(
    studentId: string,
    confirmName: string,
    schoolId: string,
  ) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, user: { schoolId } },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!student) throw new NotFoundException('Aluno não encontrado');

    if (normalizeName(confirmName) !== normalizeName(student.name)) {
      throw new BadRequestException('O nome digitado não confere');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const payments = await tx.payment.findMany({
          where: { studentId },
          select: { paymentBundleId: true },
        });
        const bundleIds = [
          ...new Set(
            payments
              .map((p) => p.paymentBundleId)
              .filter((id): id is string => id !== null),
          ),
        ];

        await tx.lesson.deleteMany({ where: { studentId } });
        await tx.payment.deleteMany({ where: { studentId } });

        // Pagamentos agregados que cobriam faturas deste aluno
        for (const bundleId of bundleIds) {
          const remaining = await tx.payment.count({
            where: { paymentBundleId: bundleId },
          });
          if (remaining === 0) {
            await tx.paymentBundle.delete({ where: { id: bundleId } });
          } else {
            // Cobre também faturas de irmãos: o valor deixou de bater, então
            // se ainda estava aberto, cancela e solta as faturas restantes.
            await tx.paymentBundle.updateMany({
              where: { id: bundleId, status: 'PENDING' },
              data: { status: 'CANCELLED' },
            });
            await tx.payment.updateMany({
              where: {
                paymentBundleId: bundleId,
                status: { not: 'PAID' },
              },
              data: { paymentBundleId: null },
            });
          }
        }

        await tx.enrollment.deleteMany({ where: { studentId } });
        await tx.student.delete({ where: { id: studentId } });

        const otherStudents = await tx.student.count({
          where: { userId: student.user.id },
        });
        let guardianDeleted = false;
        if (otherStudents === 0 && student.user.role === Role.STUDENT) {
          await tx.paymentBundle.deleteMany({
            where: { userId: student.user.id, payments: { none: {} } },
          });
          // convites e códigos de redefinição saem junto (onDelete: Cascade)
          await tx.user.delete({ where: { id: student.user.id } });
          guardianDeleted = true;
        }

        return { deleted: true, guardianDeleted };
      },
      { timeout: 20_000 },
    );
  }
}
