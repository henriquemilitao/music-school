import { Controller, Post, Get, Body, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  // POST /users — só admin cria usuário
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar usuário (admin)' })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: { schoolId: string },
  ) {
    return this.usersService.create(dto, user.schoolId);
  }

  // 2. Adicione essa rota na classe UsersController (qualquer usuário
  // logado pode registrar o próprio token, por isso sem @Roles):

  // PATCH /users/me/push-token — salva/atualiza o Expo Push Token do
  // usuário logado. Chamado pelo app assim que ele gera o token
  // (ver lib/notifications.ts no mobile).
  @Patch('me/push-token')
  @ApiOperation({ summary: 'Registrar push token do usuário logado' })
  updatePushToken(
    @Body() dto: UpdatePushTokenDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.usersService.updatePushToken(user.id, dto.pushToken);
  }

  // GET /users/me — qualquer usuário logado vê o próprio perfil
  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário logado' })
  me(@CurrentUser() user: { id: string }) {
    return this.usersService.findMe(user.id);
  }

  // GET /users — só admin lista todos da escola
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar usuários da escola (admin)' })
  findAll(@CurrentUser() user: { schoolId: string }) {
    return this.usersService.findAllBySchool(user.schoolId);
  }
}
