import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login e geração do token JWT' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('invite/validate')
  @ApiOperation({ summary: 'Valida se um token de convite ainda é válido' })
  async validateInvite(@Query('token') token: string) {
    const invite = await this.authService.validateInviteToken(token);
    return {
      valid: true,
      name: invite.user.name,
      email: invite.user.email,
    };
  }

  @Post('set-password')
  @ApiOperation({ summary: 'Define a senha a partir de um token de convite' })
  setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto.token, dto.password);
  }

  @Post('invite/:userId/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reenvia (gera novo) convite de ativação — admin' })
  resendInvite(@Param('userId') userId: string) {
    return this.authService.resendInvite(userId);
  }
}
