import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentManagementService } from './enrollment-management.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { SchedulePreviewQueryDto } from './dto/schedule-preview-query.dto';
import { EndEnrollmentDto, EndPreviewQueryDto } from './dto/end-enrollment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { EnrollmentRenewalCron } from './enrollment-renewal.cron';

@ApiTags('enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // todos os endpoints são admin only
@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private enrollmentsService: EnrollmentsService,
    private enrollmentManagement: EnrollmentManagementService,
    private enrollmentsCron: EnrollmentRenewalCron,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar matrícula e gerar primeiro mês de aulas' })
  create(@Body() dto: CreateEnrollmentDto, @CurrentUser() user: AuthUser) {
    return this.enrollmentsService.create(dto, user.schoolId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar matrículas da escola' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.enrollmentsService.findAllBySchool(user.schoolId);
  }

  @Get('student/:id')
  @ApiOperation({ summary: 'Matrícula ativa de um aluno específico' })
  findByStudent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enrollmentsService.findByStudent(id, user.schoolId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar matrícula por id' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enrollmentsService.findOne(id, user.schoolId);
  }

  @Get(':id/upcoming-lessons')
  @ApiOperation({
    summary:
      'Aulas agendadas daqui pra frente (pra escolher "a partir de qual")',
  })
  upcomingLessons(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enrollmentManagement.listUpcomingLessons(id, user.schoolId);
  }

  @Get(':id/schedule-preview')
  @ApiOperation({
    summary: 'Prévia, aula por aula, de uma troca de dia/horário (não salva)',
  })
  schedulePreview(
    @Param('id') id: string,
    @Query() query: SchedulePreviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentManagement.previewScheduleChange(
      id,
      user.schoolId,
      query,
    );
  }

  @Get(':id/end-preview')
  @ApiOperation({
    summary: 'Prévia do que será removido/mantido ao encerrar a matrícula',
  })
  endPreview(
    @Param('id') id: string,
    @Query() query: EndPreviewQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentManagement.previewEnd(
      id,
      user.schoolId,
      query.fromLessonId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Editar matrícula (instrumento, professor, valor, horário, vencimento)',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentManagement.update(id, dto, user.schoolId);
  }

  @Post(':id/end')
  @ApiOperation({
    summary:
      'Encerrar matrícula a partir de uma aula (cancela as aulas; faturas por escolha do admin)',
  })
  end(
    @Param('id') id: string,
    @Body() dto: EndEnrollmentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.enrollmentManagement.end(id, user.schoolId, dto);
  }

  @Post(':id/renew')
  @ApiOperation({ summary: 'Renovar próximo mês manualmente' })
  renew(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enrollmentsService.renew(id, user.schoolId);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Encerrar matrícula' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enrollmentsService.deactivate(id, user.schoolId);
  }

  @Post('renovar-mensalidade-debug')
  async trigger() {
    await this.enrollmentsCron.handleRenewal();
    return { status: 'disparado' };
  }
}
