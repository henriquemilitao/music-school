import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MercadoPagoConfig, Payment as MPPayment } from 'mercadopago';
import {
  PaymentProvider,
  CreateChargeInput,
  CreateChargeOutput,
  WebhookEvent,
} from './payment-provider.interface';

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'mercadopago';

  private readonly logger = new Logger(MercadoPagoProvider.name);
  private readonly client: MercadoPagoConfig;
  private readonly payment: MPPayment;
  private readonly webhookSecret: string; // MERCADOPAGO_WEBHOOK_SECRET — vem do painel, usado na validação de assinatura

  constructor(private config: ConfigService) {
    const accessToken = this.config.getOrThrow<string>(
      'MERCADOPAGO_ACCESS_TOKEN',
    );
    this.webhookSecret = this.config.getOrThrow<string>(
      'MERCADOPAGO_WEBHOOK_SECRET',
    );

    this.client = new MercadoPagoConfig({ accessToken });
    this.payment = new MPPayment(this.client);
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeOutput> {
    // idempotencyKey do PRÓPRIO Mercado Pago (header obrigatório
    // recomendado) — evita cobrança duplicada se a requisição for
    // reenviada por timeout de rede. Usamos o externalReference (que
    // já é único no nosso banco) como base.
    //
    // IMPORTANTE: incluímos também `idempotencySalt` na chave. Sem
    // isso, toda tentativa de gerar/renovar o PIX de um mesmo Payment
    // usaria a MESMA chave (porque externalReference nunca muda pra
    // aquele Payment) — e o Mercado Pago, ao ver uma chave repetida,
    // devolve a cobrança da PRIMEIRA vez em vez de criar uma nova.
    // Resultado: depois que o PIX expirava, "Gerar novo PIX" parecia
    // travado, porque na prática devolvia o mesmo código já morto.
    // O salt (timestamp da tentativa) garante uma chave nova a cada
    // renovação, mantendo a proteção contra reenvio duplicado dentro
    // da MESMA tentativa (o front não manda salt novo em retries).
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${input.externalReference}:${input.idempotencySalt ?? ''}`)
      .digest('hex');

    // expiresInSeconds vira uma data absoluta ISO — a API do MP
    // exige date_of_expiration, não um "quanto tempo dura"
    const dateOfExpiration = input.expiresInSeconds
      ? new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
      : undefined;

    try {
      const result = await this.payment.create({
        body: {
          transaction_amount: Number(input.amount.toFixed(2)),
          description: input.description,
          payment_method_id: 'pix',
          external_reference: input.externalReference,
          date_of_expiration: dateOfExpiration,
          payer: {
            email: input.payerEmail ?? 'pagador@musicschool.app', // MP exige email — fallback genérico se o front ainda não manda
            first_name: input.payerName,
            identification: input.payerCpf
              ? { type: 'CPF', number: input.payerCpf }
              : undefined,
          },
        },
        requestOptions: { idempotencyKey },
      });

      const txData = result.point_of_interaction?.transaction_data;

      if (!result.id || !txData?.qr_code) {
        throw new BadGatewayException(
          'Mercado Pago não retornou os dados de PIX esperados',
        );
      }

      return {
        externalId: String(result.id),
        pixCopyPaste: txData.qr_code,
        pixQrCode: txData.qr_code_base64
          ? `data:image/png;base64,${txData.qr_code_base64}`
          : undefined,
        expiresAt: result.date_of_expiration
          ? new Date(result.date_of_expiration)
          : undefined,
      };
    } catch (err) {
      this.logger.error('Falha ao criar cobrança PIX no Mercado Pago', err);
      throw new BadGatewayException(
        'Falha ao criar cobrança PIX no Mercado Pago',
      );
    }
  }

  // O webhook do Mercado Pago manda só um id — não o pagamento
  // completo. Por isso esse método precisa ser async: ele busca o
  // pagamento de verdade na API antes de confiar em qualquer status.
  // Isso é mais seguro que confiar no corpo bruto do webhook (que
  // poderia, em teoria, ser forjado antes mesmo de checar a
  // assinatura — aqui validamos a fonte E o conteúdo).
  async parseWebhookEvent(rawPayload: unknown): Promise<WebhookEvent> {
    const payload = rawPayload as {
      type?: string;
      action?: string;
      data?: { id?: string };
    };

    // só nos interessam notificações de pagamento — outras (ex:
    // "merchant_order") são ignoradas no controller
    if (payload.type !== 'payment' || !payload.data?.id) {
      return { externalId: '', status: 'UNKNOWN', rawPayload: payload };
    }

    try {
      const paymentData = await this.payment.get({ id: payload.data.id });

      const isPaid = paymentData.status === 'approved';

      return {
        // externalReference é o Payment.id (ou bundle:id) do NOSSO
        // banco — mandamos isso na criação, é isso que
        // processWebhookEvent usa pra achar a fatura certa
        externalId: paymentData.external_reference ?? '',
        status: isPaid ? 'PAID' : 'UNKNOWN',
        paidAt:
          isPaid && paymentData.date_approved
            ? new Date(paymentData.date_approved)
            : undefined,
        rawPayload: paymentData,
      };
    } catch (err) {
      this.logger.error(
        `Falha ao buscar pagamento ${payload.data.id} no Mercado Pago`,
        err,
      );
      // não derruba o webhook com throw — devolve UNKNOWN pra o
      // controller responder 200 e o MP não ficar reenviando em loop
      // um evento que provavelmente vai falhar de novo
      return { externalId: '', status: 'UNKNOWN', rawPayload: payload };
    }
  }

  // Assinatura do Mercado Pago vem no header x-signature, formato:
  // "ts=1704908010,v1=<hash>". O hash é HMAC-SHA256 de uma string
  // montada como "id:<dataId>;request-id:<requestId>;ts:<ts>;"
  // usando o MERCADOPAGO_WEBHOOK_SECRET como chave.
  // Doc oficial: mercadopago.com.br/developers -> Webhooks -> Assinatura
  validateWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    requestId?: string,
    dataId?: string,
  ): boolean {
    if (!signatureHeader || !requestId || !dataId) return false;

    const parts = Object.fromEntries(
      signatureHeader.split(',').map((p) => {
        const [key, value] = p.split('=');
        return [key.trim(), value?.trim()];
      }),
    );

    const ts = parts.ts;
    const receivedHash = parts.v1;
    if (!ts || !receivedHash) return false;

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    const expectedHash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(manifest)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedHash);
    const receivedBuffer = Buffer.from(receivedHash);

    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  // Mercado Pago não usa secret na query string — a validação de
  // origem é feita inteiramente via validateWebhookSignature acima.
  validateWebhookSecret(_secretFromQuery: string | undefined): boolean {
    return true;
  }
}
