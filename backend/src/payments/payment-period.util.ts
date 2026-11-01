import {
  addMonthsKeepingAnchor,
  periodStartFromKey,
} from '../enrollments/enrollment-schedule.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Primeiro dia DEPOIS do período (fim exclusivo). Se o admin ajustou o último
// dia da fatura (periodEnd), vale o ajuste; senão, é o próximo ciclo da
// matrícula, contado a partir do dia-âncora (primeira aula).
export function periodEndExclusive(
  payment: { periodEnd?: Date | null },
  periodStart: Date,
  anchorDay: number,
): Date {
  if (payment.periodEnd) {
    return new Date(payment.periodEnd.getTime() + DAY_MS);
  }
  return addMonthsKeepingAnchor(anchorDay, periodStart, 1);
}

// Período de aulas que uma fatura cobre ("AAAA-MM-DD"). O início vem da
// idempotencyKey ("<aluno>-<início>"); o fim, do ajuste do admin ou do ciclo
// da matrícula (ver periodEndExclusive).
// Fatura avulsa/antiga (chave fora do padrão) ou sem matrícula → null.
export function paymentPeriod(
  payment: { idempotencyKey: string; periodEnd?: Date | null },
  enrollment: { firstLessonDate: Date } | null,
): { periodStart: string | null; periodLastDay: string | null } {
  const start = periodStartFromKey(payment.idempotencyKey);
  if (!start || !enrollment) return { periodStart: null, periodLastDay: null };

  const end = periodEndExclusive(
    payment,
    start,
    enrollment.firstLessonDate.getUTCDate(),
  );
  return {
    periodStart: isoDay(start),
    periodLastDay: isoDay(new Date(end.getTime() - DAY_MS)),
  };
}
