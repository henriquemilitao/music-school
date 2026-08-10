import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Role } from '@prisma/client';
import { calculateAge } from '../common/utils/age.util'; // ajuste o path relativo conforme sua estrutura

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
      },
    });

    if (!student) throw new NotFoundException('Aluno não encontrado');

    return this.withAge(student);
  }

  async findAllBySchool(schoolId: string) {
    const students = await this.prisma.student.findMany({
      where: { user: { schoolId, isActive: true } },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return students.map((s) => this.withAge(s));
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
}
