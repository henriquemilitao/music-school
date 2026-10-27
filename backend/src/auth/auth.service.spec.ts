/* eslint-disable @typescript-eslint/no-unsafe-assignment --
   mocks do Prisma: os retornos são objetos de teste, não tipos reais */
import { Test } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

describe('AuthService.requestFirstAccess', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    accountInvite: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const emailService = { sendInviteEmail: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue('https://app.test') };

  let service: AuthService;

  const user = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    name: 'Maria',
    email: 'maria@email.com',
    isActive: true,
    deletedAt: null,
    passwordHash: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    config.getOrThrow.mockReturnValue('https://app.test');
    prisma.accountInvite.findFirst.mockResolvedValue(null);
    prisma.accountInvite.create.mockResolvedValue({});
    prisma.accountInvite.updateMany.mockResolvedValue({ count: 0 });
    emailService.sendInviteEmail.mockResolvedValue(true);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: config },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('e-mail desconhecido → NOT_REGISTERED e nenhum e-mail enviado', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.requestFirstAccess('x@x.com')).resolves.toEqual({
      status: 'NOT_REGISTERED',
    });
    expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('usuário inativo ou removido → NOT_REGISTERED', async () => {
    prisma.user.findFirst.mockResolvedValue(user({ isActive: false }));
    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).resolves.toEqual({ status: 'NOT_REGISTERED' });

    prisma.user.findFirst.mockResolvedValue(user({ deletedAt: new Date() }));
    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).resolves.toEqual({ status: 'NOT_REGISTERED' });
  });

  it('quem já tem senha → ALREADY_ACTIVE, sem enviar e-mail', async () => {
    prisma.user.findFirst.mockResolvedValue(user({ passwordHash: 'hash' }));

    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).resolves.toEqual({ status: 'ALREADY_ACTIVE' });
    expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('busca o e-mail sem diferenciar maiúsculas/minúsculas e sem espaços', async () => {
    prisma.user.findFirst.mockResolvedValue(user());

    await service.requestFirstAccess('  Maria@Email.com ');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'Maria@Email.com', mode: 'insensitive' } },
    });
  });

  it('cadastrado sem senha → invalida convites antigos, cria novo e envia e-mail', async () => {
    prisma.user.findFirst.mockResolvedValue(user());

    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).resolves.toEqual({ status: 'SENT' });

    expect(prisma.accountInvite.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.accountInvite.create).toHaveBeenCalledTimes(1);
    expect(emailService.sendInviteEmail).toHaveBeenCalledWith({
      to: 'maria@email.com',
      name: 'Maria',
      inviteLink: expect.stringContaining(
        'https://app.test/set-password.html?token=',
      ),
    });
  });

  it('link enviado há menos de 1 minuto → confirma sem reenviar', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    prisma.accountInvite.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 10_000),
    });

    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).resolves.toEqual({ status: 'SENT' });
    expect(emailService.sendInviteEmail).not.toHaveBeenCalled();
    expect(prisma.accountInvite.create).not.toHaveBeenCalled();
  });

  it('link antigo (> 1 minuto) → gera um novo', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    prisma.accountInvite.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 5 * 60_000),
    });

    await service.requestFirstAccess('maria@email.com');

    expect(emailService.sendInviteEmail).toHaveBeenCalledTimes(1);
  });

  it('falha no envio → erro 503 e convite invalidado (não trava nova tentativa)', async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    emailService.sendInviteEmail.mockResolvedValue(false);

    await expect(
      service.requestFirstAccess('maria@email.com'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    // 1ª chamada: limpa convites antigos; 2ª: invalida o recém-criado
    expect(prisma.accountInvite.updateMany).toHaveBeenCalledTimes(2);
  });
});
