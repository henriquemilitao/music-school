import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { EmailService } from '../email/email.service';
import { CreateFullUserDto } from './dto/create-full-user.dto';

describe('UsersService.createFull', () => {
  const schoolId = 'school-1';

  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    teacher: { count: jest.fn() },
    student: { create: jest.fn(), deleteMany: jest.fn() },
    lesson: { deleteMany: jest.fn() },
    payment: { deleteMany: jest.fn() },
    enrollment: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const authService = { createInvite: jest.fn() };
  const enrollmentsService = { create: jest.fn() };
  const emailService = { sendInviteEmail: jest.fn() };

  let service: UsersService;

  const dto = (teacherId?: string): CreateFullUserDto => ({
    name: 'Maria Silva',
    email: 'maria@email.com',
    students: [
      {
        name: 'João Silva',
        enrollment: {
          teacherId,
          startTime: '15:00',
          monthlyAmount: '250.00',
          firstLessonDate: '2026-11-02',
        },
      },
    ],
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      name: 'Maria Silva',
      email: 'maria@email.com',
      phone: null,
      role: Role.STUDENT,
    });
    prisma.student.create.mockResolvedValue({ id: 'student-1' });
    prisma.$transaction.mockResolvedValue([]);
    enrollmentsService.create.mockResolvedValue({ id: 'enrollment-1' });
    authService.createInvite.mockResolvedValue('https://app/set?token=abc');

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: authService },
        { provide: EnrollmentsService, useValue: enrollmentsService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('cria tudo e informa que o e-mail de convite saiu', async () => {
    emailService.sendInviteEmail.mockResolvedValue(true);

    const result = await service.createFull(dto(), schoolId);

    expect(result.emailSent).toBe(true);
    expect(result.inviteLink).toBe('https://app/set?token=abc');
    expect(result.students).toHaveLength(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('mantém o cadastro e sinaliza emailSent=false quando o e-mail falha', async () => {
    emailService.sendInviteEmail.mockResolvedValue(false);

    const result = await service.createFull(dto(), schoolId);

    expect(result.emailSent).toBe(false);
    expect(result.user.email).toBe('maria@email.com');
  });

  it('rejeita e-mail já cadastrado sem criar nada', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });

    await expect(service.createFull(dto(), schoolId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejeita professor inexistente antes de criar o usuário', async () => {
    prisma.teacher.count.mockResolvedValue(0);

    await expect(
      service.createFull(dto('teacher-x'), schoolId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('desfaz o cadastro se a matrícula falhar no meio', async () => {
    enrollmentsService.create.mockRejectedValue(new Error('boom'));

    await expect(service.createFull(dto(), schoolId)).rejects.toThrow('boom');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.student.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.user.delete).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
    expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
  });
});
