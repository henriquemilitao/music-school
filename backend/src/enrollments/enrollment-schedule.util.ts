// Funções puras (sem banco) usadas pela edição/encerramento de matrícula e
// pela geração de aulas. Ficam isoladas aqui pra serem testadas sem mocks.

const HOUR_MS = 60 * 60 * 1000;

// ─── Fuso da escola ─────────────────────────────────────────────────────
// As aulas são gravadas em UTC com a hora local convertida pelo offset da
// escola (ex: -4 → 08:00 local = 12:00 UTC). Estas funções fazem o caminho
// inverso: olham a data/hora "como a escola vê".

export function toLocalParts(date: Date, offsetHours: number) {
  const local = new Date(date.getTime() + offsetHours * HOUR_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth(),
    day: local.getUTCDate(),
    weekDay: local.getUTCDay(),
  };
}

// Meia-noite UTC do dia LOCAL da escola — usado pra descobrir a qual ciclo
// mensal uma aula pertence (os ciclos são contados em dias, não em horas).
export function toLocalDay(date: Date, offsetHours: number): Date {
  const { year, month, day } = toLocalParts(date, offsetHours);
  return new Date(Date.UTC(year, month, day));
}

export function parseStartTime(startTime: string): [number, number] {
  const [hours, minutes] = startTime.split(':').map(Number) as [number, number];
  return [hours, minutes];
}

// ─── Troca de dia/horário das aulas ─────────────────────────────────────

// Menor deslocamento (em dias, de -3 a +3) entre dois dias da semana.
// Ex: quarta(3) → terça(2) = -1; quarta(3) → sábado(6) = +3;
//     quarta(3) → domingo(0) = -3.
export function shortestWeekdayShift(from: number, to: number): number {
  const forward = (to - from + 7) % 7; // 0..6
  return forward > 3 ? forward - 7 : forward;
}

export interface ScheduleTarget {
  // Se omitido, a aula mantém o dia da semana que já tem
  weekDay?: number;
  // Se omitido, a aula mantém o horário que já tem
  startTime?: string;
}

// Calcula a nova data/hora de UMA aula quando o dia e/ou horário mudam.
// A aula vai pro novo dia da semana MAIS PRÓXIMO da data original (mesma
// semana, pra frente ou pra trás). Se o caminho "pra trás" cair antes de
// `notBefore` (ex: já passou), vai pra frente — nunca cria aula no passado.
export function moveLessonToSchedule(
  scheduledAt: Date,
  target: ScheduleTarget,
  offsetHours: number,
  notBefore: Date,
): Date {
  const { year, month, day, weekDay } = toLocalParts(scheduledAt, offsetHours);
  const local = new Date(scheduledAt.getTime() + offsetHours * HOUR_MS);
  const [hours, minutes] = target.startTime
    ? parseStartTime(target.startTime)
    : [local.getUTCHours(), local.getUTCMinutes()];

  const build = (shiftDays: number) =>
    new Date(
      Date.UTC(
        year,
        month,
        day + shiftDays,
        hours - offsetHours,
        minutes,
        0,
        0,
      ),
    );

  const shift =
    target.weekDay === undefined
      ? 0
      : shortestWeekdayShift(weekDay, target.weekDay);

  const candidate = build(shift);
  if (shift < 0 && candidate.getTime() < notBefore.getTime()) {
    return build(shift + 7);
  }
  return candidate;
}

// ─── Ciclos mensais ─────────────────────────────────────────────────────

// "Daqui a N meses, em que dia cai, mantendo o dia-âncora?" — se o mês de
// destino não tem aquele dia (ex: 31 em fevereiro), usa o último dia dele.
// (Mesma regra de sempre; o EnrollmentsService passa a delegar pra cá.)
export function addMonthsKeepingAnchor(
  anchorDay: number,
  referenceDate: Date,
  monthsToAdd: number,
): Date {
  const targetYear = referenceDate.getUTCFullYear();
  const targetMonth = referenceDate.getUTCMonth() + monthsToAdd;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const finalDay = Math.min(anchorDay, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, finalDay));
}

// O Payment.idempotencyKey é "<studentId>-<início do ciclo de aulas>", com o
// início no formato YYYY-MM-DD. Devolve esse início (UTC) ou null se a chave
// não segue o padrão (fatura avulsa/antiga).
export function periodStartFromKey(idempotencyKey: string): Date | null {
  const match = /(\d{4})-(\d{2})-(\d{2})$/.exec(idempotencyKey);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

// Gera uma data de vencimento cujo DIA do mês (UTC) é exatamente `day`,
// partindo do mês de `base` e avançando até um mês que tenha esse dia
// (ex: dia 31 a partir de fevereiro → março). O dia-âncora do vencimento é
// lido de firstPaymentDueDate.getUTCDate(), então o dia precisa existir.
export function dateWithAnchorDay(base: Date, day: number): Date {
  for (let offset = 0; offset < 12; offset++) {
    const candidate = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, day, 12),
    );
    if (candidate.getUTCDate() === day) return candidate;
  }
  // inalcançável pra day entre 1 e 31, mas evita retornar lixo se alguém
  // chamar com valor inválido
  throw new RangeError(`Dia de vencimento inválido: ${day}`);
}

// ─── Geração de aulas ───────────────────────────────────────────────────

// Mantém só as datas ESTRITAMENTE depois da última aula já existente.
// Garante que gerar um novo ciclo nunca duplica nem "volta no tempo" em
// relação ao que já foi criado (ex: depois de mudar o dia da semana ou o
// dia do vencimento).
export function onlyAfter(dates: Date[], lastExisting: Date | null): Date[] {
  if (!lastExisting) return dates;
  return dates.filter((date) => date.getTime() > lastExisting.getTime());
}
