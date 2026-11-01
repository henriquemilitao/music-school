// lib/paymentView.ts
//
// Regras de exibição das faturas do admin, sem React nem rede (fica fácil
// de conferir e de reaproveitar em lista e detalhe).

import type { AdminPaymentDetail, StudentPayment } from './paymentTypes';
import { formatCurrency, formatDate, formatInstantDate } from './paymentFormat';

const DAY_MS = 24 * 60 * 60 * 1000;

export const isOpenPayment = (payment: Pick<StudentPayment, 'status'>) =>
  payment.status === 'PENDING' || payment.status === 'OVERDUE';

export type PaymentGroups = {
  overdue: StudentPayment[];
  pending: StudentPayment[];
  paid: StudentPayment[];
  cancelled: StudentPayment[];
};

// Quatro grupos, na ordem em que a tela mostra: Atrasadas e Em aberto com a
// mais antiga primeiro (é a mais urgente); Pagas e Canceladas com a mais
// recente primeiro (histórico).
export function groupPayments(payments: StudentPayment[]): PaymentGroups {
  const oldestFirst = (a: StudentPayment, b: StudentPayment) =>
    a.dueDate.localeCompare(b.dueDate);
  const newestFirst = (a: StudentPayment, b: StudentPayment) =>
    b.dueDate.localeCompare(a.dueDate);
  const only = (status: StudentPayment['status']) =>
    payments.filter((payment) => payment.status === status);

  return {
    overdue: only('OVERDUE').sort(oldestFirst),
    pending: only('PENDING').sort(oldestFirst),
    paid: only('PAID').sort(newestFirst),
    cancelled: only('CANCELLED').sort(newestFirst),
  };
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

// Situação de uma fatura em aberto conforme o vencimento — mesma regra do
// backend (ao desfazer pagamento, reativar ou mudar o vencimento).
export function statusForDueDate(
  dueDate: string,
  now = new Date(),
): 'PENDING' | 'OVERDUE' {
  return new Date(dueDate).getTime() < todayUtc(now) ? 'OVERDUE' : 'PENDING';
}

const OPEN_LABEL = { PENDING: 'Pendente', OVERDUE: 'Atrasada' } as const;

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
// nem cancelada sozinha — o servidor recusa.
export function bundleLockReason(
  payment: Pick<AdminPaymentDetail, 'paymentBundle'>,
  action: 'desfazer' | 'cancelar',
): string | null {
  return payment.paymentBundle?.status === 'PAID'
    ? `Esta fatura foi paga junto com outras (pagamento agregado), então não dá para ${action} só ela.`
    : null;
}

// Texto do aviso antes de desfazer — mais forte quando o dinheiro entrou
// automaticamente (desfazer aqui só muda o app, não estorna o PIX).
export function undoConfirmMessage(
  payment: Pick<AdminPaymentDetail, 'status' | 'paymentMethod' | 'dueDate'>,
  now = new Date(),
): string {
  const back = OPEN_LABEL[statusForDueDate(payment.dueDate, now)];
  const base = `A fatura volta para “${back}” e a data do pagamento é apagada.`;
  return paidVia(payment) === 'AUTOMATIC'
    ? `${base}\n\nAtenção: este pagamento entrou automaticamente pelo PIX. Desfazer muda só o status aqui no app — não devolve o dinheiro.`
    : base;
}

type CancelInfo = Pick<
  StudentPayment,
  'status' | 'amount' | 'paidAt' | 'paymentMethod'
>;

// Texto do aviso antes de cancelar. Fatura paga pede confirmação reforçada:
// cancelar uma fatura que recebeu dinheiro raramente é o que se quer.
export function cancelConfirmMessage(payment: CancelInfo): string {
  const value = `R$ ${formatCurrency(payment.amount)}`;
  if (payment.status === 'PAID') {
    const when = payment.paidAt
      ? ` em ${formatInstantDate(payment.paidAt)}`
      : '';
    const auto =
      paidVia(payment) === 'AUTOMATIC'
        ? '\n\nEste pagamento entrou automaticamente pelo PIX: cancelar aqui não devolve o dinheiro.'
        : '';
    return (
      `Esta fatura de ${value} está PAGA${when}. Cancelar vai tirá-la dos pagamentos recebidos.` +
      `${auto}\n\nTem certeza de que é isso mesmo?`
    );
  }
  return (
    `A fatura de ${value} deixa de ser cobrada: não fica atrasada, some para o aluno e não gera lembretes. ` +
    'Continua no histórico como “Cancelada” e dá para reativar depois.'
  );
}

// Texto do aviso antes de reativar
export function reactivateMessage(
  payment: Pick<StudentPayment, 'dueDate'>,
  now = new Date(),
): string {
  const back = OPEN_LABEL[statusForDueDate(payment.dueDate, now)];
  return `A fatura volta a ser cobrada e fica “${back}”, conforme o vencimento (${formatDate(payment.dueDate)}).`;
}
