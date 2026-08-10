// Token de injeção do PaymentProvider. Usar um Symbol/string em vez
// de injetar a classe InfinitePayProvider direto é o que permite
// trocar de gateway só mudando o `useClass` aqui no module — o
// PaymentsService não sabe (nem precisa saber) qual gateway está
// por trás.
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
