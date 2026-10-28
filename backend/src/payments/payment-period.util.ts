import {
  addMonthsKeepingAnchor,
  periodStartFromKey,
} from '../enrollments/enrollment-schedule.util';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

// Período de aulas que uma fatura cobre ("AAAA-MM-DD"). O início vem da
// idempotencyKey ("<aluno>-<início>"); o fim é o último dia antes do próximo
// ciclo, contado a partir do dia-âncora da matrícula (primeira aula).
// Fatura avulsa/antiga (chave fora do padrão) ou sem matrícula → null.
export function paymentPeriod(
  payment: { idempotencyKey: string },
  enrollment: { firstLessonDate: Date } | null,
): { periodStart: string | null; periodLastDay: string | null } {
  const start = periodStartFromKey(payment.idempotencyKey);
  if (!start || !enrollment) return { periodStart: null, periodLastDay: null };

  const nextCycle = addMonthsKeepingAnchor(
    enrollment.firstLessonDate.getUTCDate(),
    start,
    1,
  );
  return {
    periodStart: isoDay(start),
    periodLastDay: isoDay(new Date(nextCycle.getTime() - DAY_MS)),
  };
}
