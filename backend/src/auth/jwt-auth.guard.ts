import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// guard que protege rotas — basta colocar @UseGuards(JwtAuthGuard) em qualquer rota
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
