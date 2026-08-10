import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private studentsService: StudentsService) {}

  // GET /students/me — retorna os Students do User logado
  @Get('me')
  @ApiOperation({ summary: 'Meus alunos vinculados (pai ou adulto logado)' })
  findMe(@CurrentUser() user: AuthUser) {
    return this.studentsService.findMe(user.id);
  }

  // GET /students — admin lista todos da escola
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar todos os alunos (admin)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.studentsService.findAllBySchool(user.schoolId);
  }

  // GET /students/:id — admin busca por id
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Buscar aluno por id (admin)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.studentsService.findOne(id, user.schoolId);
  }

  // POST /students — admin cria Student vinculado a um User
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar aluno vinculado a um usuário (admin)' })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthUser) {
    return this.studentsService.create(dto, user.schoolId);
  }

  // PATCH /students/:id — admin ou dono atualiza
  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados do aluno' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.studentsService.update(id, dto, user);
  }
}
