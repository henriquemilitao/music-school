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
// essa rota é o gateway (Mercado Pago), não um usuário logado.
//
// IMPORTANTE: pra validar a assinatura corretamente, o NestJS precisa
// ter acesso ao rawBody — configurado com `rawBody: true` no main.ts.
@ApiTags('payments')
@Controller('payments/webhook')
export class PaymentsWebhookController {
  private readonly logger = new Logger(PaymentsWebhookController.name);

  constructor(
    private paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
  ) {}

  @Post(':provider')
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Param('provider') providerName: string,
    @Req() req: FastifyRequest & { rawBody?: Buffer | string },
    @Query('webhookSecret') webhookSecret: string | undefined,
    @Query('data.id') dataIdFromQuery: string | undefined, // MP também manda o id como query param
    @Headers('x-signature') signature: string,
    @Headers('x-request-id') requestId: string,
  ) {
    if (providerName !== this.provider.name) {
      this.logger.warn(
        `Webhook recebido de provider desconhecido: ${providerName}`,
      );
      return { status: 'ignored', reason: 'unknown_provider' };
    }

    if (!this.provider.validateWebhookSecret(webhookSecret)) {
      this.logger.warn(
        'Webhook rejeitado — secret da query string não confere',
      );
      throw new UnauthorizedException('Secret inválido');
    }

    const rawBody = req.rawBody
      ? req.rawBody.toString()
      : JSON.stringify(req.body);

    // o data.id também pode vir só no corpo, dependendo do tipo de
    // notificação — usamos o da query como primeira fonte (é o que a
    // doc do MP usa pra montar a assinatura) com fallback pro corpo
    const bodyDataId = (req.body as { data?: { id?: string } })?.data?.id;
    const dataId = dataIdFromQuery ?? bodyDataId;

    const isValidSignature = this.provider.validateWebhookSignature(
      rawBody,
      signature,
      requestId,
      dataId,
    );
    if (!isValidSignature) {
      this.logger.warn(
        'Webhook rejeitado — assinatura inválida (possível tentativa fraudulenta)',
      );
      throw new BadRequestException('Assinatura inválida');
    }

    this.logger.log(`RAW BODY: ${JSON.stringify(req.body)}`);

    // AWAIT — parseWebhookEvent agora é async (busca o pagamento
    // completo na API do Mercado Pago antes de confiar no status)
    const event = await this.provider.parseWebhookEvent(req.body);

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
