// ═══════════════════════════════════════════════════════════
// Contrato que QUALQUER gateway precisa cumprir.
//
// Essa interface é a peça-chave da escalabilidade que você pediu:
// o PaymentsService nunca fala diretamente com "MercadoPago" —
// ele fala com "PaymentProvider". Trocar de gateway no futuro
// significa só escrever uma nova classe que implementa essa
// interface, sem tocar no resto do sistema.
//
// MUDANÇA (migração AbacatePay -> MercadoPago): parseWebhookEvent
// agora é async. Motivo: a AbacatePay manda o objeto de pagamento
// COMPLETO dentro do próprio corpo do webhook — não precisava de
// nenhuma chamada extra. O Mercado Pago manda só um id
// ({ type: "payment", data: { id } }) e exige uma consulta
// adicional (GET /v1/payments/{id}) pra saber o status real e o
// externalReference. Isso é mais seguro (evita confiar em dados
// que vieram só do corpo, sem confirmação via API), mas exige que
// o método possa fazer uma chamada de rede.
// ═══════════════════════════════════════════════════════════

export interface CreateChargeInput {
  amount: number; // valor em reais (ex: 200.00)
  externalReference: string; // id do Payment no seu banco — pro gateway devolver isso no webhook
  description: string; // ex: "Mensalidade Julho/2026 - João Aluno"
  payerName?: string;
  payerEmail?: string; // Mercado Pago exige e-mail do pagador pra criar o pagamento
  payerCpf?: string; // opcional, mas reduz risco de recusa/fraude no MP
  expiresInSeconds?: number; // quanto tempo esse PIX deve durar
  // NOVO — muda a cada tentativa de gerar/renovar um PIX pro MESMO
  // externalReference. Sem isso, o Mercado Pago usa o idempotencyKey
  // (derivado do externalReference) pra devolver a cobrança ANTERIOR
  // já expirada em vez de criar uma nova — era exatamente isso que
  // fazia "Gerar novo PIX" parecer travado depois da expiração.
  idempotencySalt?: string;
}

export interface CreateChargeOutput {
  externalId: string; // id da cobrança no gateway
  checkoutUrl?: string; // link hospedado, se o gateway usar esse modelo
  pixCopyPaste?: string; // código copia-e-cola
  pixQrCode?: string; // imagem do QR code (base64)
  expiresAt?: Date; // quando esse PIX expira, segundo o gateway
}

export interface WebhookEvent {
  externalId: string; // id da cobrança no gateway
  status: 'PAID' | 'PENDING' | 'UNKNOWN';
  paidAt?: Date;
  rawPayload: unknown;
}

export interface PaymentProvider {
  readonly name: string; // "mercadopago" | "abacatepay" | etc — vai no campo `provider` do Payment

  createCharge(input: CreateChargeInput): Promise<CreateChargeOutput>;

  // Converte o payload cru do webhook pro formato normalizado acima.
  // ASYNC agora — ver nota no topo do arquivo.
  parseWebhookEvent(rawPayload: unknown): Promise<WebhookEvent>;

  // Valida a assinatura do corpo da requisição (garante que o
  // corpo não foi alterado em trânsito e veio mesmo do gateway).
  // Retorna false se a assinatura não bater — quem chama isso deve
  // rejeitar o webhook com 401/400 nesse caso.
  validateWebhookSignature(
    rawBody: string,
    signatureHeader: string,
    requestId?: string, // MP usa x-request-id junto da assinatura
    dataId?: string, // MP inclui o id do recurso na string assinada
  ): boolean;

  // Segunda camada de proteção, independente da assinatura: alguns
  // gateways (como a AbacatePay) também exigem um secret na própria
  // URL do webhook. O Mercado Pago não usa esse mecanismo — a
  // implementação concreta dele sempre retorna true aqui.
  validateWebhookSecret(secretFromQuery: string | undefined): boolean;
}
