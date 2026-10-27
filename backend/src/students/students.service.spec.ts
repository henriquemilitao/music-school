/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await --
   mocks do Prisma: os retornos são objetos de teste, não tipos reais */
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StudentsService', () => {
  const schoolId = 'school-1';

  const prisma = {
    student: {
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    user: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    lesson: { deleteMany: jest.fn() },
    payment: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentBundle: {
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    enrollment: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };

  let service: StudentsService;

  const studentRow = (role: Role = Role.STUDENT) => ({
    id: 'stu-1',
    name: 'João da Silva',
    birthDate: null,
    user: { id: 'user-1', role, email: 'maria@email.com' },
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (tx: unknown) => unknown)(prisma)
        : arg,
    );
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.student.count.mockResolvedValue(0);

    const moduleRef = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(StudentsService);
  });

  describe('deletePermanently', () => {
    it('nome diferente → erro e nada é apagado', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());

      await expect(
        service.deletePermanently('stu-1', 'Joao', schoolId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('aluno de outra escola → 404', async () => {
      prisma.student.findFirst.mockResolvedValue(null);
      await expect(
        service.deletePermanently('stu-1', 'João da Silva', schoolId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('aceita o nome sem acento, em minúsculas e com espaços extras', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());

      await expect(
        service.deletePermanently('stu-1', '  joao  da   silva ', schoolId),
      ).resolves.toEqual({ deleted: true, guardianDeleted: true });
    });

    it('apaga aulas, faturas, matrículas e o aluno; remove o responsável sem outros alunos', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());

      const result = await service.deletePermanently(
        'stu-1',
        'João da Silva',
        schoolId,
      );

      expect(prisma.lesson.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 'stu-1' },
      });
      expect(prisma.payment.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 'stu-1' },
      });
      expect(prisma.enrollment.deleteMany).toHaveBeenCalledWith({
        where: { studentId: 'stu-1' },
      });
      expect(prisma.student.delete).toHaveBeenCalledWith({
        where: { id: 'stu-1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual({ deleted: true, guardianDeleted: true });
    });

    it('mantém o responsável quando ele tem outro aluno (irmão)', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());
      prisma.student.count.mockResolvedValue(1);

      const result = await service.deletePermanently(
        'stu-1',
        'João da Silva',
        schoolId,
      );

      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(result.guardianDeleted).toBe(false);
    });

    it('nunca apaga a conta se o titular não for do tipo aluno/responsável', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow(Role.ADMIN));

      const result = await service.deletePermanently(
        'stu-1',
        'João da Silva',
        schoolId,
      );

      expect(prisma.user.delete).not.toHaveBeenCalled();
      expect(result.guardianDeleted).toBe(false);
    });

    it('pagamento agregado vazio é apagado; com faturas de irmão é cancelado e solto', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());
      prisma.payment.findMany.mockResolvedValue([
        { paymentBundleId: 'b-empty' },
        { paymentBundleId: 'b-shared' },
        { paymentBundleId: null },
      ]);
      prisma.payment.count.mockImplementation(
        async ({ where }: { where: { paymentBundleId: string } }) =>
          where.paymentBundleId === 'b-shared' ? 1 : 0,
      );

      await service.deletePermanently('stu-1', 'João da Silva', schoolId);

      expect(prisma.paymentBundle.delete).toHaveBeenCalledWith({
        where: { id: 'b-empty' },
      });
      expect(prisma.paymentBundle.updateMany).toHaveBeenCalledWith({
        where: { id: 'b-shared', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { paymentBundleId: 'b-shared', status: { not: 'PAID' } },
        data: { paymentBundleId: null },
      });
    });
  });

  describe('updateProfile', () => {
    it('e-mail já usado por outra conta → 409', async () => {
      prisma.student.findFirst.mockResolvedValue(studentRow());
      prisma.user.findFirst.mockResolvedValue({ id: 'other' });

      await expect(
        service.updateProfile(
          'stu-1',
          { guardianEmail: 'outra@email.com' },
          schoolId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('atualiza aluno e responsável, limpa telefone vazio', async () => {
      prisma.student.findFirst
        .mockResolvedValueOnce(studentRow())
        .mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.student.update.mockImplementation((args) => ({
        op: 'student',
        args,
      }));
      prisma.user.update.mockImplementation((args) => ({ op: 'user', args }));
      jest
        .spyOn(service, 'findOne')
        .mockResolvedValue({ id: 'stu-1' } as never);

      await service.updateProfile(
        'stu-1',
        {
          name: '  João Pedro da Silva ',
          guardianName: 'Maria Silva',
          guardianEmail: 'nova@email.com',
          guardianPhone: '',
        },
        schoolId,
      );

      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'stu-1' },
        data: { name: 'João Pedro da Silva' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Maria Silva', email: 'nova@email.com', phone: null },
      });
    });
  });
});
