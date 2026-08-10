import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/auth/current-user.decorator';

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
