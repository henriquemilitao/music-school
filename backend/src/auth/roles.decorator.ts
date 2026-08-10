import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

// decorator que define quais roles podem acessar uma rota
// ex: @Roles(Role.ADMIN) — só admin acessa
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
