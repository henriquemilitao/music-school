// import { Injectable, BadGatewayException } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as crypto from 'crypto';
// import {
//   PaymentProvider,
//   CreateChargeInput,
//   CreateChargeOutput,
//   WebhookEvent,
// } from './payment-provider.interface';

// // Chave HMAC pública da AbacatePay — não é secreta, é a mesma pra
// // todo mundo, documentada oficialmente em docs.abacatepay.com/pages/webhooks.
// // Serve só pra confirmar que o corpo da requisição não foi alterado
// // em trânsito. NÃO é o seu ABACATEPAY_WEBHOOK_SECRET (esse é outro,
// // escolhido por você, e vai na query string da URL do webhook).
// const ABACATEPAY_PUBLIC_KEY =
//   't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9';

// // Formato de resposta do POST /transparents/create (confirmado na doc oficial)
// interface TransparentChargeResponse {
//   id: string;
//   amount: number;
//   status: string;
//   devMode: boolean;
//   brCode: string;
//   brCodeBase64: string;
//   platformFee: number;
//   expiresAt: string;
//   createdAt: string;
//   updatedAt: string;
//   metadata?: Record<string, unknown>;
// }

// interface AbacatePayApiEnvelope<T> {
//   data: T | null;
//   error: string | null;
//   success: boolean;
// }

// // Envelope REAL confirmado em produção (dev mode) — diferente do que
// // a doc mostrava. O objeto da cobrança fica aninhado em
// // data.transparent, não direto em data. externalId já vem pronto
// // dentro de data.transparent.externalId (não precisa ler do metadata).
// interface AbacatePayWebhookEnvelope {
//   id: string;
//   event: string; // "transparent.completed" | "transparent.refunded" | etc
//   apiVersion: number;
//   devMode: boolean;
//   data: {
//     transparent: {
//       id: string; // id da cobrança (pix_char_...)
//       externalId: string; // nosso Payment.id — vem pronto aqui
//       amount: number;
//       paidAmount: number | null;
//       status: string; // "PAID" quando pago
//       [key: string]: unknown;
//     };
//     [key: string]: unknown;
//   };
// }

// @Injectable()
// export class AbacatePayProvider implements PaymentProvider {
//   readonly name = 'abacatepay';

//   private readonly baseUrl = 'https://api.abacatepay.com/v2';
//   private readonly apiKey: string;
//   private readonly webhookSecret: string;

//   constructor(private config: ConfigService) {
//     this.apiKey = this.config.getOrThrow<string>('ABACATEPAY_API_KEY');
//     this.webhookSecret = this.config.getOrThrow<string>(
//       'ABACATEPAY_WEBHOOK_SECRET',
//     );
//   }

//   async createCharge(input: CreateChargeInput): Promise<CreateChargeOutput> {
//     const amountInCents = Math.round(input.amount * 100);

//     const response = await fetch(`${this.baseUrl}/transparents/create`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${this.apiKey}`,
//       },
//       body: JSON.stringify({
//         method: 'PIX',
//         data: {
//           amount: amountInCents,
//           description: input.description,
//           externalId: input.externalReference,
//           expiresIn: input.expiresInSeconds, // NOVO — undefined = usa o default da AbacatePay
//           metadata: {
//             externalId: input.externalReference,
//           },
//         },
//       }),
//     });

//     const json =
//       (await response.json()) as AbacatePayApiEnvelope<TransparentChargeResponse>;

//     if (!response.ok || !json.success || !json.data) {
//       throw new BadGatewayException(
//         `Falha ao criar cobrança PIX na AbacatePay: ${json.error ?? 'erro desconhecido'}`,
//       );
//     }

//     return {
//       externalId: json.data.id,
//       pixCopyPaste: json.data.brCode,
//       pixQrCode: json.data.brCodeBase64,
//       expiresAt: new Date(json.data.expiresAt), // NOVO
//     };
//   }

//   parseWebhookEvent(rawPayload: unknown): WebhookEvent {
//     const payload = rawPayload as AbacatePayWebhookEnvelope;
//     const transparent = payload.data?.transparent;

//     // só nos importamos com eventos de pagamento confirmado — outros
//     // eventos (refund, dispute) passam com status UNKNOWN e são
//     // ignorados no controller
//     const isPaid =
//       payload.event === 'transparent.completed' &&
//       transparent?.status === 'PAID';

//     return {
//       // IMPORTANTE: usamos externalId (o Payment.id do NOSSO banco),
//       // não transparent.id (o id da cobrança NO GATEWAY) — é assim
//       // que processWebhookEvent consegue achar a fatura certa.
//       // Fallback pra string vazia se o payload vier malformado —
//       // processWebhookEvent trata isso como "payment_not_found" e
//       // ignora, em vez de quebrar com erro de tipo.
//       externalId: transparent?.externalId ?? '',
//       status: isPaid ? 'PAID' : 'UNKNOWN',
//       paidAt: isPaid ? new Date() : undefined,
//       rawPayload: payload,
//     };
//   }

//   // Confere a assinatura HMAC-SHA256 do corpo cru contra o header
//   // X-Webhook-Signature, usando a chave pública fixa da AbacatePay.
//   // Isso garante que o corpo não foi alterado em trânsito.
//   validateWebhookSignature(rawBody: string, signatureHeader: string): boolean {
//     if (!signatureHeader) return false;

//     const bodyBuffer = Buffer.from(rawBody, 'utf8');
//     const expectedSig = crypto
//       .createHmac('sha256', ABACATEPAY_PUBLIC_KEY)
//       .update(bodyBuffer)
//       .digest('base64');

//     const expectedBuffer = Buffer.from(expectedSig);
//     const receivedBuffer = Buffer.from(signatureHeader);

//     if (expectedBuffer.length !== receivedBuffer.length) return false;

//     return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
//   }

//   // Segunda camada: confere o secret que a própria AbacatePay manda
//   // de volta na query string da URL (?webhookSecret=...), que é o
//   // ABACATEPAY_WEBHOOK_SECRET escolhido por você no .env.
//   validateWebhookSecret(secretFromQuery: string | undefined): boolean {
//     return secretFromQuery === this.webhookSecret;
//   }
// }
