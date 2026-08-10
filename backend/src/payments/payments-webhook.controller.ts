import {
  Controller,
  Post,
  Param,
  Req,
  Query,
  Headers,
  BadRequestException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payments.constants';
import type { PaymentProvider } from './providers/payment-provider.interface';

// Controller separado e SEM JwtAuthGuard de propósito — quem chama
// essa rota é o gateway (AbacatePay), não um usuário logado.
//
// Duas camadas de segurança, nessa ordem:
// 1. Secret na query string (?webhookSecret=...) — comparação simples
// 2. Assinatura HMAC no header X-Webhook-Signature — garante que o
//    corpo não foi alterado em trânsito
//
// IMPORTANTE: pra validar a assinatura corretamente, o NestJS precisa
// ter acesso ao rawBody (string exata que a AbacatePay assinou), não
// o body já parseado como JSON. Isso exige `rawBody: true` no
// main.ts — sem isso, req.rawBody vem undefined e a validação de
// assinatura sempre falha.
@ApiTags('payments')
@Controller('payments/webhook')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
  ) {}

  @Post(':provider')
  @ApiExcludeEndpoint() // não expor no Swagger — não é uma rota que humanos chamam
  async handleWebhook(
    @Param('provider') providerName: string,
    @Req() req: FastifyRequest & { rawBody?: Buffer | string },
    @Query('webhookSecret') webhookSecret: string | undefined,
    @Headers('x-webhook-signature') signature: string,
  ) {
    if (providerName !== this.provider.name) {
      this.logger.warn(
        `Webhook recebido de provider desconhecido: ${providerName}`,
      );
      return { status: 'ignored', reason: 'unknown_provider' };
    }

    // camada 1: secret na query string
    if (!this.provider.validateWebhookSecret(webhookSecret)) {
      this.logger.warn(
        'Webhook rejeitado — secret da query string não confere',
      );
      throw new UnauthorizedException('Secret inválido');
    }

    // camada 2: assinatura HMAC do corpo
    const rawBody = req.rawBody
      ? req.rawBody.toString()
      : JSON.stringify(req.body);

    const isValidSignature = this.provider.validateWebhookSignature(
      rawBody,
      signature,
    );
    if (!isValidSignature) {
      this.logger.warn(
        'Webhook rejeitado — assinatura HMAC inválida (possível tentativa fraudulenta)',
      );
      throw new BadRequestException('Assinatura inválida');
    }

    this.logger.log(`RAW BODY: ${JSON.stringify(req.body)}`);

    const event = this.provider.parseWebhookEvent(req.body);

    this.logger.log(
      `Webhook processado: externalId=${event.externalId} status=${event.status}`,
    );

    if (event.status !== 'PAID') {
      return { status: 'ignored', reason: 'not_paid' };
    }

    return this.paymentsService.processWebhookEvent(
      event.externalId,
      event.paidAt,
    );
  }
}
