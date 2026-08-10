import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// payload é o que fica dentro do token JWT
export interface JwtPayload {
  sub: string; // id do usuário
  email: string;
  role: string;
  schoolId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    super({
      // extrai o token do header Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ??
        (() => {
          throw new Error('JWT_SECRET não definido');
        })(),
    });
  }

  async validate(payload: JwtPayload) {
    // valida se o usuário ainda existe e está ativo
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuário inativo ou não encontrado');
    }

    // o que retornar aqui fica disponível em req.user em qualquer rota protegida
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
    };
  }
}
