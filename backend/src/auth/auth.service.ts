import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

const INVITE_EXPIRATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // usuário convidado que ainda não definiu senha — dá uma mensagem
    // clara em vez de deixar o bcrypt.compare quebrar com hash null
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
  // CONVITE / DEFINIÇÃO DE SENHA
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

  // reemite um convite novo — invalida qualquer convite anterior
  // ainda pendente pro mesmo usuário (perdeu o link, expirou, etc)
  async resendInvite(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    await this.prisma.accountInvite.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() }, // invalida os pendentes
    });

    return this.createInvite(userId);
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
}
