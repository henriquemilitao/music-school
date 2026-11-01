// Regras puras de edição de fatura (sem banco, sem Nest): datas "de calendário"
// e o status que uma fatura em aberto deve ter. Ficam aqui pra serem testadas
// sem montar o serviço inteiro.

export const CIVIL_DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const HOUR_MS = 60 * 60 * 1000;

// "2026-10-05" → meio-dia UTC desse dia. É o mesmo formato do vencimento
// criado na matrícula (toNoonUTC): meio-dia nunca cai em outro dia civil em
// nenhum fuso do Brasil. Devolve null pra dia inexistente (ex: 2026-02-31).
export function civilDateToNoonUtc(dateKey: string): Date | null {
  if (!CIVIL_DATE_REGEX.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCDate() === day ? date : null;
}

// Dia civil ("AAAA-MM-DD") em que a escola está agora.
export function schoolToday(now: Date, offsetHours: number): string {
  return new Date(now.getTime() + offsetHours * HOUR_MS)
    .toISOString()
    .slice(0, 10);
}

// Pra onde vai uma fatura em aberto conforme o vencimento: ATRASADA só depois
// que o dia do vencimento passou (mesma regra do cron e do "desfazer").
export function openStatusForDueDate(
  dueDate: Date,
  now: Date,
): 'PENDING' | 'OVERDUE' {
  const todayStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return dueDate.getTime() < todayStart ? 'OVERDUE' : 'PENDING';
}

export type PaidAtResult =
  { ok: true; paidAt: Date } | { ok: false; reason: 'invalid' | 'future' };

// Data de pagamento informada pelo admin. Hoje → o instante de agora; dia
// passado → meio-dia UTC daquele dia; dia futuro ou inválido → recusa.
export function resolvePaidAt(
  dateKey: string,
  now: Date,
  offsetHours: number,
): PaidAtResult {
  const noon = civilDateToNoonUtc(dateKey);
  if (!noon) return { ok: false, reason: 'invalid' };
  const today = schoolToday(now, offsetHours);
  if (dateKey > today) return { ok: false, reason: 'future' };
  return { ok: true, paidAt: dateKey === today ? now : noon };
}

// A chave de idempotência termina com o início do período ("<aluno>-AAAA-MM-DD").
// Trocar o início do período é trocar esse final.
export function withPeriodStart(
  idempotencyKey: string,
  periodStart: string,
): string {
  return idempotencyKey.replace(/\d{4}-\d{2}-\d{2}$/, periodStart);
}
