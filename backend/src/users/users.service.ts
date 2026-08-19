import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { calculateAge } from '../common/utils/age.util';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto, schoolId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        schoolId,
        name: dto.name,
        email: dto.email,
        passwordHash,
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

    return user;
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
    // Um pushToken pertence a UM device físico. Se outro usuário
    // (conta de teste anterior, ou device emprestado) já estiver
    // com esse mesmo token registrado, ele precisa perder o token —
    // senão os dois recebem push um do outro.
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
}
