// ═══════════════════════════════════════════════════════════
// Contrato que QUALQUER gateway precisa cumprir.
//
// Essa interface é a peça-chave da escalabilidade que você pediu:
// o PaymentsService nunca fala diretamente com "AbacatePay" —
// ele fala com "PaymentProvider". Trocar de gateway no futuro
// significa só escrever uma nova classe que implementa essa
// interface, sem tocar no resto do sistema.
// ═══════════════════════════════════════════════════════════

export interface CreateChargeInput {
  amount: number; // valor em reais (ex: 200.00)
  externalReference: string; // id do Payment no seu banco — pro gateway devolver isso no webhook
  description: string; // ex: "Mensalidade Julho/2026 - João Aluno"
  payerName?: string;
  expiresInSeconds?: number; // NOVO — quanto tempo esse PIX deve durar
}

export interface CreateChargeOutput {
  externalId: string; // id da cobrança no gateway
  checkoutUrl?: string; // link hospedado, se o gateway usar esse modelo (AbacatePay não usa pro PIX)
  pixCopyPaste?: string; // código copia-e-cola
  pixQrCode?: string; // imagem do QR code (base64)
  expiresAt?: Date; // NOVO — quando esse PIX expira, segundo o gateway
}

export interface WebhookEvent {
  externalId: string; // id da cobrança no gateway
  status: 'PAID' | 'PENDING' | 'UNKNOWN';
  paidAt?: Date;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: string; // "infinitepay" | "abacatepay" | etc — vai no campo `provider` do Payment

  createCharge(input: CreateChargeInput): Promise<CreateChargeOutput>;

  // Converte o payload cru do webhook pro formato normalizado acima
  parseWebhookEvent(rawPayload: unknown): WebhookEvent;

  // Valida a assinatura HMAC do corpo da requisição (garante que o
  // corpo não foi alterado em trânsito e veio mesmo do gateway).
  // Retorna false se a assinatura não bater — quem chama isso deve
  // rejeitar o webhook com 401/400 nesse caso.
  validateWebhookSignature(rawBody: string, signatureHeader: string): boolean;

  // Segunda camada de proteção, independente da assinatura: alguns
  // gateways (como a AbacatePay) também exigem um secret na própria
  // URL do webhook. Esse método confere esse secret. Se o gateway não
  // usar esse mecanismo, a implementação concreta pode sempre
  // retornar true.
  validateWebhookSecret(secretFromQuery: string | undefined): boolean;
}
