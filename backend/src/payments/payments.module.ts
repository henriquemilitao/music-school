import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER } from './payments.constants';
import { MercadoPagoProvider } from './providers/mercadopago.provider';

@Module({
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    // troca de gateway = trocar só essa linha (useClass) por outra
    // classe que implemente PaymentProvider
    {
      provide: PAYMENT_PROVIDER,
      useClass: MercadoPagoProvider,
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
