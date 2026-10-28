import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER } from './payments.constants';

describe('PaymentsService — admin: detalhes e desfazer pagamento', () => {
  const schoolId = 'school-1';
  const prisma = {
    student: { findFirst: jest.fn() },
    payment: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  let service: PaymentsService;

  const paid = (over: Record<string, unknown> = {}) => ({
    id: 'pay-1',
    schoolId,
    status: 'PAID',
    dueDate: new Date('2000-01-10T00:00:00Z'),
    paidAt: new Date('2000-01-09T12:00:00Z'),
    paymentMethod: 'MANUAL_PIX',
    proofUrl: 'http://comprovante',
    confirmedBy: 'admin-1',
    webhookReceivedAt: null,
    idempotencyKey: 'stu-1-2000-01-05',
    paymentBundle: null,
    ...over,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.payment.update.mockImplementation((args: unknown) => args);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_PROVIDER, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  describe('unconfirm (desfazer pagamento)', () => {
    const dataSent = () =>
      (
        prisma.payment.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;

    it('vencimento já passou: volta como ATRASADA e limpa os dados da confirmação', async () => {
      prisma.payment.findFirst.mockResolvedValue(paid());

      await service.unconfirm('pay-1', schoolId, 'admin-2');

      expect(dataSent()).toEqual({
        status: 'OVERDUE',
        paidAt: null,
        paymentMethod: 'GATEWAY',
        proofUrl: null,
        confirmedBy: null,
        webhookReceivedAt: null,
      });
    });

    it('vencimento no futuro: volta como PENDENTE', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        paid({ dueDate: new Date('2099-01-10T00:00:00Z') }),
      );
      await service.unconfirm('pay-1', schoolId, 'admin-2');
      expect(dataSent().status).toBe('PENDING');
    });

    it('recusa fatura que não está paga', async () => {
      prisma.payment.findFirst.mockResolvedValue(paid({ status: 'PENDING' }));
      await expect(
        service.unconfirm('pay-1', schoolId, 'admin-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('recusa fatura paga dentro de um pagamento agregado já pago', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        paid({ paymentBundle: { status: 'PAID' } }),
      );
      await expect(
        service.unconfirm('pay-1', schoolId, 'admin-2'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('agregado cancelado/aberto não impede desfazer', async () => {
      prisma.payment.findFirst.mockResolvedValue(
        paid({ paymentBundle: { status: 'CANCELLED' } }),
      );
      await service.unconfirm('pay-1', schoolId, 'admin-2');
      expect(prisma.payment.update).toHaveBeenCalled();
    });

    it('fatura de outra escola não é encontrada', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.unconfirm('pay-1', schoolId, 'admin-2'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findByStudent', () => {
    it('devolve cada fatura com o período de aulas e sem vazar a matrícula', async () => {
      prisma.student.findFirst.mockResolvedValue({ id: 'stu-1' });
      prisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          idempotencyKey: 'stu-1-2026-10-05',
          enrollment: { firstLessonDate: new Date('2026-08-05T00:00:00Z') },
        },
        { id: 'pay-2', idempotencyKey: 'manual', enrollment: null },
      ]);

      const result = await service.findByStudent('stu-1', schoolId);

      expect(result[0]).toMatchObject({
        id: 'pay-1',
        periodStart: '2026-10-05',
        periodLastDay: '2026-11-04',
      });
      expect(result[0]).not.toHaveProperty('enrollment');
      expect(result[1]).toMatchObject({
        periodStart: null,
        periodLastDay: null,
      });
    });
  });

  describe('findAdminDetail', () => {
    it('traz período e o nome de quem confirmou', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...paid(),
        student: { id: 'stu-1', name: 'Ana', instrument: 'PIANO' },
        enrollment: { firstLessonDate: new Date('2026-08-05T00:00:00Z') },
      });
      prisma.user.findUnique.mockResolvedValue({ name: 'Secretaria' });

      const detail = await service.findAdminDetail('pay-1', schoolId);

      expect(detail).toMatchObject({
        periodStart: '2000-01-05',
        confirmedByName: 'Secretaria',
      });
      expect(detail).not.toHaveProperty('enrollment');
    });

    it('sem confirmação não busca usuário', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...paid({ status: 'PENDING', confirmedBy: null }),
        student: { id: 'stu-1', name: 'Ana', instrument: null },
        enrollment: null,
      });
      const detail = await service.findAdminDetail('pay-1', schoolId);
      expect(detail.confirmedByName).toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('404 se não for da escola', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.findAdminDetail('pay-1', schoolId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
