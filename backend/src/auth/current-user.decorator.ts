// src/auth/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  schoolId: string;
}

// decorator auxiliar pra pegar dados do usuário logado no req.user
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp() // pega o contexto HTTP (vs WebSocket, gRPC, etc.)
      .getRequest<{ user: AuthUser }>(); // tipagem do que esperamos em req
    return request.user; // retorna só o user, não o request inteiro
  },
);
