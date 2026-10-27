import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomInt, createHash } from 'crypto';
import { EmailService } from 'src/email/email.service';

const INVITE_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias
const RESET_PASSWORD_EXPIRATION_MS = 1000 * 60 * 15; // 15 minutos — código curto, janela menor que o link antigo (30min)
const MAX_RESET_ATTEMPTS = 5; // trava o código depois de 5 tentativas erradas
const FIRST_ACCESS_COOLDOWN_MS = 1000 * 60; // intervalo mínimo entre e-mails de "criar senha" pro mesmo usuário

// Resultado do "Criar minha senha" (primeiro acesso) na tela de login.
//  - SENT:           link de criação de senha enviado por e-mail
//  - NOT_REGISTERED: e-mail não existe na escola (pedir pra escola cadastrar)
//  - ALREADY_ACTIVE: a pessoa já tem senha (usar login / esqueci minha senha)
export type FirstAccessStatus = 'SENT' | 'NOT_REGISTERED' | 'ALREADY_ACTIVE';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private emailService: EmailService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Conta ainda não ativada. Verifique o link de criação de senha enviado a você.',
      );
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // ─────────────────────────────────────────────
  // CONVITE / DEFINIÇÃO DE SENHA (inalterado)
  // ─────────────────────────────────────────────

  async createInvite(userId: string) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.accountInvite.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + INVITE_EXPIRATION_MS),
      },
    });

    const appUrl = this.config.getOrThrow<string>('APP_URL');
    return `${appUrl}/set-password.html?token=${rawToken}`;
  }

  async resendInvite(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    await this.prisma.accountInvite.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const inviteLink = await this.createInvite(userId);

    await this.emailService.sendInviteEmail({
      to: user.email,
      name: user.name,
      inviteLink,
    });

    return { status: 'ok', inviteLink };
  }

  // ─────────────────────────────────────────────
  // PRIMEIRO ACESSO — o próprio usuário pede o link de criação de senha
  // (sem depender do admin reenviar convite).
  //
  // Diferente do "esqueci minha senha", aqui a resposta DIZ se o e-mail
  // está cadastrado: pais já informaram o e-mail pra escola e precisam
  // saber se o problema é "falta criar a senha" ou "escola não cadastrou".
  // O vazamento de existência de e-mail é uma escolha de produto; o abuso
  // é contido pelo rate limit global por IP + intervalo mínimo por usuário.
  // ─────────────────────────────────────────────
  async requestFirstAccess(
    email: string,
  ): Promise<{ status: FirstAccessStatus }> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email.trim(), mode: 'insensitive' } },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return { status: 'NOT_REGISTERED' };
    }

    if (user.passwordHash) {
      return { status: 'ALREADY_ACTIVE' };
    }

    // Já mandamos um link há poucos segundos (o admin acabou de cadastrar
    // ou a pessoa tocou duas vezes)? Não reenvia — só confirma.
    const lastInvite = await this.prisma.accountInvite.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    if (
      lastInvite &&
      Date.now() - lastInvite.createdAt.getTime() < FIRST_ACCESS_COOLDOWN_MS
    ) {
      return { status: 'SENT' };
    }

    // Só o link mais novo vale (mesmo comportamento do resendInvite).
    await this.invalidatePendingInvites(user.id);
    const inviteLink = await this.createInvite(user.id);

    const sent = await this.emailService.sendInviteEmail({
      to: user.email,
      name: user.name,
      inviteLink,
    });

    if (!sent) {
      // Sem e-mail entregue, o convite não serve pra nada — invalida pra
      // não travar a próxima tentativa no intervalo mínimo.
      await this.invalidatePendingInvites(user.id);
      throw new ServiceUnavailableException(
        'Não foi possível enviar o e-mail agora. Tente novamente em instantes.',
      );
    }

    return { status: 'SENT' };
  }

  private invalidatePendingInvites(userId: string) {
    return this.prisma.accountInvite.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async validateInviteToken(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invite = await this.prisma.accountInvite.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      throw new UnauthorizedException('Convite inválido ou expirado');
    }

    return invite;
  }

  async setPassword(rawToken: string, newPassword: string) {
    const invite = await this.validateInviteToken(rawToken);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: invite.userId },
        data: { passwordHash },
      }),
      this.prisma.accountInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { status: 'ok' };
  }

  // ─────────────────────────────────────────────
  // ESQUECI MINHA SENHA — fluxo por código de 6 dígitos (app mobile)
  // ─────────────────────────────────────────────

  // Gera o código, salva o hash e dispara o e-mail.
  // Resposta pro controller é SEMPRE genérica (ver comentário abaixo).
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const genericResponse = {
      message:
        'Se este e-mail estiver cadastrado, você receberá um código de verificação em instantes.',
    };

    // IMPORTANTE: a resposta é SEMPRE a mesma, exista o e-mail ou não —
    // evita enumeração de usuários (ver explicação original no código).
    if (!user || !user.isActive) {
      return genericResponse;
    }

    // código numérico de 6 dígitos, gerado com CSPRNG (não Math.random)
    const code = randomInt(100000, 1000000).toString();
    const codeHash = createHash('sha256').update(code).digest('hex');

    // Invalida qualquer código anterior ainda pendente pro mesmo
    // usuário — evita ter vários códigos válidos ao mesmo tempo se a
    // pessoa pedir reset mais de uma vez.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt: new Date(Date.now() + RESET_PASSWORD_EXPIRATION_MS),
      },
    });

    await this.emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      code,
    });

    return genericResponse;
  }

  // Usado pela tela 2 (digitar código) ANTES de pedir a nova senha —
  // só confirma que o código bate, sem gastar/marcar como usado ainda.
  // Reaproveitado internamente por resetPassword() também.
  private async findValidResetToken(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // mensagem genérica também aqui — não revela se o e-mail existe
    if (!user) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Código inválido ou expirado');
    }

    if (resetToken.attempts >= MAX_RESET_ATTEMPTS) {
      throw new BadRequestException(
        'Número máximo de tentativas excedido. Solicite um novo código.',
      );
    }

    const codeHash = createHash('sha256').update(code).digest('hex');

    if (codeHash !== resetToken.codeHash) {
      // incrementa tentativa errada — protege contra força bruta nos 6 dígitos
      await this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Código inválido ou expirado');
    }

    return { user, resetToken };
  }

  // Rota chamada pela tela 2 — só valida, não altera nada.
  async validateResetCode(email: string, code: string) {
    const { user } = await this.findValidResetToken(email, code);
    return { valid: true, name: user.name, email: user.email };
  }

  // Rota chamada pela tela 3 — revalida o código (nunca confia só na
  // validação da tela anterior) e efetivamente troca a senha.
  async resetPassword(email: string, code: string, newPassword: string) {
    const { user, resetToken } = await this.findValidResetToken(email, code);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // aviso de segurança — não bloqueia a resposta se falhar (mesmo
    // padrão de fire-and-forget do EmailService)
    void this.emailService.sendPasswordChangedEmail({
      to: user.email,
      name: user.name,
    });

    return { status: 'ok' };
  }
}
