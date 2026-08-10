import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';

// interface que descreve o shape de req.user (preenchido pelo JwtStrategy)
interface RequestUser {
  id: string;
  email: string;
  role: Role;
  schoolId: string;
}

interface AuthenticatedRequest {
  user: RequestUser;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return requiredRoles.includes(user.role);
  }
}
