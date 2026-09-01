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
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { FindPaymentsQueryDto } from './dto/find-payments-query.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateBundleDto } from './dto/create-bundle.dto';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── Rotas do aluno ───────────────────────────────────────────────────

  // GET /payments/my — lista pagamentos de TODOS os students do usuário
  // logado. Passe ?studentId=xxx pra filtrar só um aluno específico
  // (útil se o front quiser abas por filho).
  @Get('my')
  @ApiOperation({
    summary:
      'Listar meus pagamentos (todos os alunos vinculados, ou um específico via studentId)',
  })
  @ApiQuery({ name: 'studentId', required: false })
  findMy(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.paymentsService.findMyPayments(user.id, studentId);
  }

  // GET /payments/my/current — fatura em aberto (PENDING/OVERDUE) de
  // TODOS os students do usuário logado, cada um com sua própria
  // fatura mais urgente. Passe ?studentId=xxx pra filtrar só um aluno
  // específico (retorna o objeto do payment direto, não uma lista).
  @Get('my/current')
  @ApiOperation({
    summary:
      'Fatura em aberto de cada aluno vinculado ao usuário logado (ou de um específico via studentId)',
  })
  @ApiQuery({ name: 'studentId', required: false })
  findMyCurrent(
    @CurrentUser() user: AuthUser,
    @Query('studentId') studentId?: string,
  ) {
    return this.paymentsService.findMyCurrentPayment(user.id, studentId);
  }

  // GET /payments/my/:id — detalhe de uma fatura específica do aluno logado
  @Get('my/:id')
  @ApiOperation({ summary: 'Ver detalhes de uma fatura (sem gerar PIX)' })
  findMyOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findMyPaymentById(id, user.id);
  }

  // POST /payments/my/:id/charge — gera/garante o PIX
  @Post('my/:id/charge')
  @ApiOperation({ summary: 'Gerar (ou renovar) o PIX de uma fatura' })
  generateMyCharge(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.getOrCreateMyPaymentCharge(id, user.id);
  }

  // ─── Rotas do admin ───────────────────────────────────────────────────

  // payments.controller.ts — dentro das rotas admin
  @Get('student/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar faturas de um aluno específico (admin)' })
  findByStudent(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findByStudent(id, user.schoolId);
  }

  // GET /payments?month=2026-07 — lista pagamentos por mês
  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar pagamentos por mês (admin)' })
  findByMonth(
    @CurrentUser() user: AuthUser,
    @Query() query: FindPaymentsQueryDto,
  ) {
    const month = query.month ?? this.currentMonthKey();
    return this.paymentsService.findByMonth(month, user.schoolId);
  }

  // GET /payments/pending — lista pendentes/atrasados (quem cobrar)
  @Get('pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Listar pagamentos pendentes ou atrasados (admin)' })
  findPending(@CurrentUser() user: AuthUser) {
    return this.paymentsService.findPending(user.schoolId);
  }

  // POST /payments/bundle — cria pagamento agregado de várias faturas
  @Post('bundle')
  @ApiOperation({
    summary: 'Criar um pagamento agregado cobrindo várias faturas escolhidas',
  })
  createBundle(@Body() dto: CreateBundleDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.createBundle(
      user.id,
      user.schoolId,
      dto.paymentIds,
    );
  }

  // GET /payments/bundle/:id — detalhe de um bundle específico
  @Get('bundle/:id')
  @ApiOperation({ summary: 'Detalhe de um pagamento agregado' })
  findMyBundle(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findMyBundleById(id, user.id);
  }

  // GET /payments/:id — busca por id
  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Buscar pagamento por id (admin)' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findOne(id, user.schoolId);
  }

  // POST /payments/:id/checkout — gera/regera o link de cobrança no gateway
  @Post(':id/checkout')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Gerar link de cobrança no gateway pra uma fatura (admin)',
  })
  generateCheckout(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.generateCheckout(id, user.schoolId);
  }

  // PATCH /payments/:id/confirm — fallback manual
  @Patch(':id/confirm')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Confirmar pagamento manualmente (fallback — não é o fluxo principal)',
  })
  confirmManually(
    @Param('id') id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.confirmManually(
      id,
      dto,
      user.id,
      user.schoolId,
    );
  }

  private currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}
