// lib/paymentView.ts
//
// Regras de exibição das faturas do admin, sem React nem rede (fica fácil
// de conferir e de reaproveitar em lista e detalhe).

import type { AdminPaymentDetail, StudentPayment } from './paymentTypes';
import { formatDate } from './paymentFormat';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isOpenPayment = (payment: Pick<StudentPayment, 'status'>) =>
  payment.status !== 'PAID';

// Em aberto primeiro (a mais antiga no topo: é a mais urgente) e, abaixo,
// o histórico de pagas (mais recente primeiro, como já vem da API).
export function splitPayments(payments: StudentPayment[]) {
  const open = payments
    .filter(isOpenPayment)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const settled = payments.filter((p) => !isOpenPayment(p));
  return { open, settled };
}

// "05/10 a 04/11" · null quando a fatura não tem período (avulsa/antiga)
export function formatPeriodRange(
  periodStart: string | null,
  periodLastDay: string | null,
): string | null {
  if (!periodStart || !periodLastDay) return null;
  const short = (day: string) => formatDate(day).slice(0, 5);
  return `${short(periodStart)} a ${short(periodLastDay)}`;
}

// Dia civil de hoje (meia-noite UTC), igual ao que o servidor usa pra decidir
// entre pendente e atrasada.
function todayUtc(now: Date) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

// Pra onde a fatura volta ao desfazer o pagamento — mesma regra do backend
export function statusAfterUndo(
  dueDate: string,
  now = new Date(),
): 'PENDING' | 'OVERDUE' {
  return new Date(dueDate).getTime() < todayUtc(now) ? 'OVERDUE' : 'PENDING';
}

// "Vence hoje" · "Vence em 3 dias" · "Venceu há 2 dias"
export function dueHint(dueDate: string, now = new Date()): string {
  const diff = Math.round(
    (new Date(dueDate).getTime() - todayUtc(now)) / DAY_MS,
  );
  if (diff === 0) return 'Vence hoje';
  if (diff === 1) return 'Vence amanhã';
  if (diff > 1) return `Vence em ${diff} dias`;
  if (diff === -1) return 'Venceu ontem';
  return `Venceu há ${-diff} dias`;
}

export type PaidVia = 'MANUAL' | 'AUTOMATIC';

export function paidVia(
  payment: Pick<StudentPayment, 'status' | 'paymentMethod'>,
): PaidVia | null {
  if (payment.status !== 'PAID') return null;
  return payment.paymentMethod === 'MANUAL_PIX' ? 'MANUAL' : 'AUTOMATIC';
}

// Fatura paga junto com outras (pagamento agregado) não pode ser desfeita
// sozinha — o servidor recusa.
export function undoBlockedReason(
  payment: Pick<AdminPaymentDetail, 'paymentBundle'>,
): string | null {
  return payment.paymentBundle?.status === 'PAID'
    ? 'Esta fatura foi paga junto com outras (pagamento agregado), então não dá para desfazer só ela.'
    : null;
}

// Texto do aviso antes de desfazer — mais forte quando o dinheiro entrou
// automaticamente (desfazer aqui só muda o app, não estorna o PIX).
export function undoConfirmMessage(
  payment: Pick<AdminPaymentDetail, 'status' | 'paymentMethod' | 'dueDate'>,
  now = new Date(),
): string {
  const back =
    statusAfterUndo(payment.dueDate, now) === 'OVERDUE'
      ? 'Atrasada'
      : 'Pendente';
  const base = `A fatura volta para “${back}” e a data do pagamento é apagada.`;
  return paidVia(payment) === 'AUTOMATIC'
    ? `${base}\n\nAtenção: este pagamento entrou automaticamente pelo PIX. Desfazer muda só o status aqui no app — não devolve o dinheiro.`
    : base;
}
