// lib/paymentEdit.ts
//
// Formulário de "Editar fatura": estado, validação e o corpo do PATCH (só o
// que mudou). Sem React nem rede.

import { dateToText, moneyDigitsToApi, parseDate } from './newStudent';
import type { AdminPaymentDetail, UpdatePaymentBody } from './paymentTypes';

// Mesmo teto do servidor (um período é de ~1 mês; isso só pega erro de ano)
export const MAX_PERIOD_DAYS = 92;
// R$ 100.000,00 em centavos (teto do servidor)
const MAX_AMOUNT_CENTS = 10_000_000;

// Datas em DD/MM/AAAA (o formato dos campos de data do app)
export type PaymentEditForm = {
  amountDigits: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string;
};

export type PaymentEditErrors = Partial<Record<keyof PaymentEditForm, string>>;

export type PaymentEditShape = {
  hasPeriod: boolean;
  isPaid: boolean;
};

// "2026-10-05" (ou "2026-10-05T12:00:00Z") -> "05/10/2026"
export function isoToText(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function paymentEditShape(
  payment: Pick<AdminPaymentDetail, 'status' | 'periodStart' | 'periodLastDay'>,
): PaymentEditShape {
  return {
    hasPeriod: !!payment.periodStart && !!payment.periodLastDay,
    isPaid: payment.status === 'PAID',
  };
}

export function paymentToForm(payment: AdminPaymentDetail): PaymentEditForm {
  return {
    amountDigits: String(Math.round(Number(payment.amount) * 100)),
    // dueDate é um dia civil gravado ao meio-dia UTC: o pedaço da data basta
    dueDate: isoToText(payment.dueDate),
    periodStart: payment.periodStart ? isoToText(payment.periodStart) : '',
    periodEnd: payment.periodLastDay ? isoToText(payment.periodLastDay) : '',
    // paidAt é um instante: o dia vale no calendário do aparelho
    paidAt: payment.paidAt ? dateToText(new Date(payment.paidAt)) : '',
  };
}

export function isPaymentFormDirty(
  initial: PaymentEditForm,
  form: PaymentEditForm,
): boolean {
  return (Object.keys(initial) as (keyof PaymentEditForm)[]).some(
    (key) => initial[key] !== form[key],
  );
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function validatePaymentForm(
  form: PaymentEditForm,
  shape: PaymentEditShape,
  today: Date = new Date(),
): PaymentEditErrors {
  const errors: PaymentEditErrors = {};
  const cents = Number(form.amountDigits || 0);

  if (cents <= 0) errors.amountDigits = 'Informe o valor';
  else if (cents > MAX_AMOUNT_CENTS) errors.amountDigits = 'Valor muito alto';

  if (!parseDate(form.dueDate)) errors.dueDate = 'Escolha o vencimento';

  if (shape.hasPeriod) {
    const start = parseDate(form.periodStart);
    const end = parseDate(form.periodEnd);
    if (!start) errors.periodStart = 'Escolha o início';
    if (!end) errors.periodEnd = 'Escolha o fim';
    if (start && end) {
      if (end < start) {
        errors.periodEnd = 'O fim não pode ser antes do início';
      } else if (daysBetween(start, end) + 1 > MAX_PERIOD_DAYS) {
        errors.periodEnd = `O período não pode passar de ${MAX_PERIOD_DAYS} dias`;
      }
    }
  }

  if (shape.isPaid) {
    const paidAt = parseDate(form.paidAt);
    if (!paidAt) errors.paidAt = 'Escolha o dia do pagamento';
    else if (paidAt > (parseDate(dateToText(today)) ?? '')) {
      errors.paidAt = 'O pagamento não pode ser no futuro';
    }
  }

  return errors;
}

// Só o que mudou. Se o início OU o fim do período mudou, vão os dois (o
// servidor fixa o fim para ele não "pular" com o ciclo da matrícula).
export function buildPaymentPatch(
  initial: PaymentEditForm,
  form: PaymentEditForm,
  shape: PaymentEditShape,
): UpdatePaymentBody {
  const body: UpdatePaymentBody = {};

  if (form.amountDigits !== initial.amountDigits) {
    body.amount = Number(moneyDigitsToApi(form.amountDigits));
  }
  if (form.dueDate !== initial.dueDate) {
    body.dueDate = parseDate(form.dueDate) ?? undefined;
  }
  if (
    shape.hasPeriod &&
    (form.periodStart !== initial.periodStart ||
      form.periodEnd !== initial.periodEnd)
  ) {
    body.periodStart = parseDate(form.periodStart) ?? undefined;
    body.periodEnd = parseDate(form.periodEnd) ?? undefined;
  }
  if (shape.isPaid && form.paidAt !== initial.paidAt) {
    body.paidAt = parseDate(form.paidAt) ?? undefined;
  }

  return body;
}
