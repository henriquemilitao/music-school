import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { EnrollmentsService } from './enrollments.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('enrollments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // todos os endpoints são admin only
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private enrollmentsService: EnrollmentsService) {}

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
}
