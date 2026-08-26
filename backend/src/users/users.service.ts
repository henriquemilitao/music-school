import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '@prisma/client';
import { calculateAge } from '../common/utils/age.util';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
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
}
