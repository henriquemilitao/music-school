import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import {
  BulkDeleteLessonsDto,
  BulkUpdateLessonsDto,
} from './dto/bulk-lessons.dto';
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

  // POST /lessons — cria aula avulsa
  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar aula avulsa (admin)' })
  create(@Body() dto: CreateLessonDto, @CurrentUser() user: AuthUser) {
    return this.lessonsService.create(dto, user.schoolId);
  }

  // PATCH /lessons/bulk — edita várias aulas de uma vez (status, professor,
  // instrumento, duração, dia e horário). Declarada antes de ':id' pra
  // "bulk" não ser lido como id.
  @Patch('bulk')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Editar várias aulas de uma vez (admin)' })
  bulkUpdate(@Body() dto: BulkUpdateLessonsDto, @CurrentUser() user: AuthUser) {
    return this.lessonsService.bulkUpdate(dto, user.schoolId);
  }

  // POST /lessons/bulk-delete — exclui várias aulas de uma vez
  @Post('bulk-delete')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Excluir várias aulas de uma vez (admin)' })
  bulkDelete(@Body() dto: BulkDeleteLessonsDto, @CurrentUser() user: AuthUser) {
    return this.lessonsService.bulkDelete(dto, user.schoolId);
  }

  // GET /lessons?month=2026-07 — lista aulas da escola por mês
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar aulas da escola por mês (admin)' })
  @ApiQuery({ name: 'month', example: '2026-07' })
  findByMonth(@CurrentUser() user: AuthUser, @Query('month') month: string) {
    return this.lessonsService.findByMonth(month, user.schoolId);
  }

  // GET /lessons/day?start=2026-09-18T04:00:00.000Z&end=2026-09-19T04:00:00.000Z
  // — lista aulas da escola em um dia (admin). start/end vêm prontos em
  // ISO/UTC, já calculados pelo cliente no seu próprio fuso local — o
  // backend não decide o que é "meia-noite do dia X", só compara.
  @Get('day')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Listar aulas da escola em um dia específico (admin)',
  })
  @ApiQuery({ name: 'start', example: '2026-09-18T04:00:00.000Z' })
  @ApiQuery({ name: 'end', example: '2026-09-19T04:00:00.000Z' })
  findByDay(
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.lessonsService.findByDay(start, end, user.schoolId);
  }

  // GET /lessons/:id — busca aula por id
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Buscar aula por id (admin)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.findOne(id, user.schoolId);
  }

  // PATCH /lessons/:id — edita a aula (status, dia/hora, duração, professor,
  // instrumento, anotações). Cancelar é só mandar status CANCELLED; reagendar
  // uma aula cancelada é mandar a nova data com status SCHEDULED.
  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Editar aula: status, data/hora, duração, professor, instrumento...',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLessonDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.lessonsService.update(id, dto, user.schoolId);
  }

  // DELETE /lessons/:id — exclui a aula
  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Excluir aula (admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lessonsService.remove(id, user.schoolId);
  }

  // GET /lessons/student/:id?status=SCHEDULED — aulas de um aluno da escola.
  // Só admin: devolve as anotações das aulas, que são do aluno e não
  // podem vazar pra outro aluno logado (use /lessons/my no app do aluno).
  @Get('student/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar aulas de um aluno (admin)' })
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
