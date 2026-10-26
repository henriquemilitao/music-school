import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('teachers')
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar professores da escola (admin)' })
  findAll(@CurrentUser() user: AuthUser) {
    return this.teachersService.findAllBySchool(user.schoolId);
  }
}
