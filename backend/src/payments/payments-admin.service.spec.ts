import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER } from './payments.constants';

describe('PaymentsService — admin: detalhes e desfazer pagamento', () => {
  const schoolId = 'school-1';
  const prisma = {
    student: { findFirst: jest.fn(), findMany: jest.fn() },
    payment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentBundle: { update: jest.fn() },
    school: { findUniqueOrThrow: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
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
    prisma.paymentBundle.update.mockImplementation((args: unknown) => args);
    prisma.payment.updateMany.mockImplementation((args: unknown) => args);
    prisma.$transaction.mockImplementation((ops: unknown[]) =>
      Promise.all(ops),
    );
    prisma.school.findUniqueOrThrow.mockResolvedValue({
      timezoneOffsetHours: -4,
    });
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
  // ─── editar / cancelar / reativar ────────────────────────────────────

  describe('edição de fatura', () => {
    const open = (over: Record<string, unknown> = {}) => ({
      id: 'pay-1',
      schoolId,
      studentId: 'stu-1',
      enrollmentId: 'enr-1',
      status: 'PENDING',
      amount: '150',
      dueDate: new Date('2099-01-10T12:00:00Z'),
      idempotencyKey: 'stu-1-2099-01-05',
      paymentBundleId: null,
      paymentBundle: null,
      pixQrCode: 'qr',
      ...over,
    });
    // 1ª leitura = a fatura; as seguintes = o detalhe devolvido no fim
    const loadPayment = (payment: ReturnType<typeof open>) =>
      prisma.payment.findFirst
        .mockResolvedValueOnce(payment)
        .mockResolvedValue({
          ...payment,
          student: { id: 'stu-1', name: 'Ana', instrument: null },
          enrollment: null,
        });
    const updateData = () =>
      (
        prisma.payment.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;

    it('mudar o valor zera o PIX já gerado', async () => {
      loadPayment(open());
      await service.updatePayment('pay-1', { amount: 120 }, schoolId, 'adm');
      expect(updateData()).toMatchObject({
        amount: 120,
        paidAmount: null,
        pixQrCode: null,
        pixCopyPaste: null,
        pixExpiresAt: null,
      });
    });

    it('mudar o valor solta o pagamento agregado ainda aberto', async () => {
      loadPayment(
        open({ paymentBundleId: 'b-1', paymentBundle: { status: 'PENDING' } }),
      );
      await service.updatePayment('pay-1', { amount: 120 }, schoolId, 'adm');
      expect(prisma.paymentBundle.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { status: 'CANCELLED' },
      });
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { paymentBundleId: 'b-1' },
        data: { paymentBundleId: null },
      });
    });

    it('recusa mudar o valor de fatura paga dentro de agregado pago', async () => {
      loadPayment(
        open({
          status: 'PAID',
          paymentBundleId: 'b-1',
          paymentBundle: { status: 'PAID' },
        }),
      );
      await expect(
        service.updatePayment('pay-1', { amount: 120 }, schoolId, 'adm'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('vencimento no passado deixa a fatura em aberto como ATRASADA', async () => {
      loadPayment(open());
      await service.updatePayment(
        'pay-1',
        { dueDate: '2000-01-10' },
        schoolId,
        'adm',
      );
      expect(updateData()).toMatchObject({
        status: 'OVERDUE',
        dueDate: new Date('2000-01-10T12:00:00Z'),
      });
    });

    it('vencimento numa fatura paga não muda o status nem o PIX', async () => {
      loadPayment(open({ status: 'PAID' }));
      await service.updatePayment(
        'pay-1',
        { dueDate: '2000-01-10' },
        schoolId,
        'adm',
      );
      expect(updateData()).toEqual({
        dueDate: new Date('2000-01-10T12:00:00Z'),
      });
    });

    it('início do período troca o final da chave', async () => {
      loadPayment(open());
      prisma.payment.findUnique.mockResolvedValue(null);
      await service.updatePayment(
        'pay-1',
        { periodStart: '2099-01-12' },
        schoolId,
        'adm',
      );
      expect(updateData()).toEqual({ idempotencyKey: 'stu-1-2099-01-12' });
    });

    it('recusa período que já é de outra fatura do aluno', async () => {
      loadPayment(open());
      prisma.payment.findUnique.mockResolvedValue({ id: 'pay-2' });
      await expect(
        service.updatePayment(
          'pay-1',
          { periodStart: '2099-01-12' },
          schoolId,
          'adm',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa ajustar período de fatura avulsa', async () => {
      loadPayment(open({ enrollmentId: null, idempotencyKey: 'manual' }));
      await expect(
        service.updatePayment(
          'pay-1',
          { periodStart: '2099-01-12' },
          schoolId,
          'adm',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('dia do pagamento: só em fatura paga e nunca no futuro', async () => {
      loadPayment(open());
      await expect(
        service.updatePayment('pay-1', { paidAt: '2000-01-02' }, schoolId, 'a'),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.payment.findFirst.mockReset();
      loadPayment(open({ status: 'PAID' }));
      await expect(
        service.updatePayment('pay-1', { paidAt: '2099-01-02' }, schoolId, 'a'),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.payment.findFirst.mockReset();
      loadPayment(open({ status: 'PAID' }));
      await service.updatePayment(
        'pay-1',
        { paidAt: '2000-01-02' },
        schoolId,
        'a',
      );
      expect(updateData()).toEqual({
        paidAt: new Date('2000-01-02T12:00:00Z'),
      });
    });

    it('recusa editar fatura cancelada', async () => {
      loadPayment(open({ status: 'CANCELLED' }));
      await expect(
        service.updatePayment('pay-1', { amount: 100 }, schoolId, 'adm'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('sem nada pra mudar não grava', async () => {
      loadPayment(open());
      await service.updatePayment('pay-1', { amount: 150 }, schoolId, 'adm');
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelar e reativar', () => {
    const base = (over: Record<string, unknown> = {}) => ({
      id: 'pay-1',
      schoolId,
      status: 'OVERDUE',
      amount: '150',
      dueDate: new Date('2000-01-10T12:00:00Z'),
      paymentBundleId: null,
      paymentBundle: null,
      ...over,
    });
    const loadPayment = (payment: ReturnType<typeof base>) =>
      prisma.payment.findFirst
        .mockResolvedValueOnce(payment)
        .mockResolvedValue({
          ...payment,
          student: { id: 'stu-1', name: 'Ana', instrument: null },
          enrollment: null,
        });
    const updateData = () =>
      (
        prisma.payment.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;

    it('cancelar anula, guarda o motivo e limpa o PIX', async () => {
      loadPayment(base());
      await service.cancel('pay-1', 'Fez 1 aula', schoolId, 'adm');
      expect(updateData()).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Fez 1 aula',
        pixQrCode: null,
      });
      expect(updateData().cancelledAt).toBeInstanceOf(Date);
    });

    it('cancelar fatura paga é permitido (o app confirma antes)', async () => {
      loadPayment(base({ status: 'PAID' }));
      await service.cancel('pay-1', undefined, schoolId, 'adm');
      expect(updateData()).toMatchObject({
        status: 'CANCELLED',
        cancelReason: null,
      });
    });

    it('cancelar solta o agregado ainda aberto', async () => {
      loadPayment(
        base({ paymentBundleId: 'b-1', paymentBundle: { status: 'PENDING' } }),
      );
      await service.cancel('pay-1', undefined, schoolId, 'adm');
      expect(prisma.paymentBundle.update).toHaveBeenCalled();
    });

    it('recusa cancelar fatura paga dentro de agregado pago', async () => {
      loadPayment(
        base({
          status: 'PAID',
          paymentBundleId: 'b-1',
          paymentBundle: { status: 'PAID' },
        }),
      );
      await expect(
        service.cancel('pay-1', undefined, schoolId, 'adm'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa cancelar duas vezes', async () => {
      loadPayment(base({ status: 'CANCELLED' }));
      await expect(
        service.cancel('pay-1', undefined, schoolId, 'adm'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reativar volta como ATRASADA (vencida) e limpa o pagamento', async () => {
      prisma.payment.findFirst
        .mockResolvedValueOnce(base({ status: 'CANCELLED' }))
        .mockResolvedValue({
          ...base(),
          student: { id: 'stu-1', name: 'Ana', instrument: null },
          enrollment: null,
        });
      await service.reactivate('pay-1', schoolId, 'adm');
      expect(updateData()).toMatchObject({
        status: 'OVERDUE',
        cancelledAt: null,
        cancelReason: null,
        paidAt: null,
        confirmedBy: null,
      });
    });

    it('reativar vencimento futuro volta como PENDENTE', async () => {
      prisma.payment.findFirst
        .mockResolvedValueOnce(
          base({
            status: 'CANCELLED',
            dueDate: new Date('2099-01-10T12:00:00Z'),
          }),
        )
        .mockResolvedValue({
          ...base(),
          student: { id: 'stu-1', name: 'Ana', instrument: null },
          enrollment: null,
        });
      await service.reactivate('pay-1', schoolId, 'adm');
      expect(updateData().status).toBe('PENDING');
    });

    it('recusa reativar fatura que não está cancelada', async () => {
      loadPayment(base());
      await expect(
        service.reactivate('pay-1', schoolId, 'adm'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('confirmar pagamento com data', () => {
    const openPayment = {
      id: 'pay-1',
      schoolId,
      status: 'PENDING',
      student: { user: { name: 'Ana', email: 'a@a' } },
    };
    const sent = () =>
      (
        prisma.payment.update.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;

    it('usa o dia informado', async () => {
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      await service.confirmManually(
        'pay-1',
        { paidAt: '2000-01-02' },
        'adm',
        schoolId,
      );
      expect(sent()).toMatchObject({
        status: 'PAID',
        paidAt: new Date('2000-01-02T12:00:00Z'),
      });
    });

    it('sem data usa agora', async () => {
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      await service.confirmManually('pay-1', {}, 'adm', schoolId);
      expect(sent().paidAt).toBeInstanceOf(Date);
    });

    it('recusa data no futuro', async () => {
      prisma.payment.findFirst.mockResolvedValue(openPayment);
      await expect(
        service.confirmManually(
          'pay-1',
          { paidAt: '2099-01-02' },
          'a',
          schoolId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('recusa confirmar fatura cancelada', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        ...openPayment,
        status: 'CANCELLED',
      });
      await expect(
        service.confirmManually('pay-1', {}, 'adm', schoolId),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('fatura cancelada e o resto do sistema', () => {
    it('aluno não vê fatura cancelada', async () => {
      prisma.student.findMany.mockResolvedValue([{ id: 'stu-1' }]);
      prisma.payment.findMany.mockResolvedValue([]);
      await service.findMyPayments('user-1');
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: { in: ['stu-1'] }, status: { not: 'CANCELLED' } },
        }),
      );
    });

    it('PIX pago numa fatura cancelada não muda o status (alerta p/ conciliar)', async () => {
      prisma.payment.findUnique = jest.fn().mockResolvedValue({
        id: 'pay-1',
        status: 'CANCELLED',
        amount: '150',
        paidAmount: null,
        externalId: 'pix_1',
      });
      const result = await service.processWebhookEvent(
        'payment:pay-1',
        undefined,
      );
      expect(result).toMatchObject({ status: 'processed_with_warning' });
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });
});
