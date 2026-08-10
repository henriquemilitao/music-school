import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { LessonStatus, Role } from '@prisma/client';
import { LessonsService } from './lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('lessons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private lessonsService: LessonsService) {}

  // ─── Rotas do aluno ───────────────────────────────────────────────────

  // GET /lessons/my/dashboard — dashboard do aluno logado
  @Get('my/dashboard')
  @ApiOperation({
    summary: 'Dashboard do aluno: próxima aula, última aula e pagamento atual',
  })
  getDashboard(@CurrentUser() user: AuthUser) {
    return this.lessonsService.getDashboard(user.id);
  }

  // GET /lessons/my?status=SCHEDULED&studentId=xxx — aulas do aluno logado
  @Get('my')
  @ApiOperation({ summary: 'Listar minhas aulas' })
  @ApiQuery({ name: 'status', enum: LessonStatus, required: false })
  @ApiQuery({ name: 'studentId', required: false })
  findMy(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: LessonStatus,
    @Query('studentId') studentId?: string,
  ) {
    return this.lessonsService.findMyLessons(user.id, studentId, status);
  }

  // GET /lessons/my/:id — detalhe de uma aula específica do aluno logado
  @Get('my/:id')
  @ApiOperation({ summary: 'Detalhe de uma aula específica (aluno)' })
  findMyLessonById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.findMyLessonById(user.id, id);
  }

  // ─── Rotas do admin ───────────────────────────────────────────────────

  // POST /lessons — cria aula avulsa ou de reposição
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar aula avulsa ou de reposição (admin)' })
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: AuthUser) {
    return this.lessonsService.create(dto, user.schoolId);
  }

  // GET /lessons?month=2026-07 — lista aulas da escola por mês
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar aulas da escola por mês (admin)' })
  @ApiQuery({ name: 'month', example: '2026-07' })
  findByMonth(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.lessonsService.findByMonth(month, user.schoolId);
  }

  // GET /lessons/day?date=2026-08-03 — lista aulas da escola em um dia (admin)
  @Get('day')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Listar aulas da escola em um dia específico (admin)',
  })
  @ApiQuery({ name: 'date', example: '2026-08-03' })
  findByDay(@CurrentUser() user: AuthUser, @Query('date') date: string) {
    return this.lessonsService.findByDay(date, user.schoolId);
  }

  // GET /lessons/:id — busca aula por id
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Buscar aula por id (admin)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.findOne(id, user.schoolId);
  }

  // PATCH /lessons/:id — atualiza status, notas ou cancela
  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Atualizar aula: status, notas, cancelamento (admin)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.update(id, dto, user.schoolId);
  }

  // GET /lessons/student?status=SCHEDULED&studentId=xxx — aulas do aluno logado
  @Get('student/:id')
  @ApiOperation({ summary: 'Listar aulas de um aluno' })
  @ApiQuery({ name: 'status', enum: LessonStatus, required: false })
  findStudentLessons(
    @CurrentUser() user: AuthUser,
    @Param('id') studentId: string,
    @Query('status') status?: LessonStatus,
  ) {
    return this.lessonsService.findLessonsByStudent(
      user.schoolId,
      studentId,
      status,
    );
  }
}
