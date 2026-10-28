// Funções puras (sem banco) da edição de aulas. Ficam isoladas pra serem
// testadas sem mocks, no mesmo espírito de enrollments/enrollment-schedule.util.

import {
  parseStartTime,
  toLocalParts,
} from '../enrollments/enrollment-schedule.util';

const HOUR_MS = 60 * 60 * 1000;

export interface LessonShift {
  // Desloca a aula em N dias (negativo = pra trás). Ex: segunda → quarta = 2.
  shiftDays?: number;
  // Novo horário "HH:mm" (hora LOCAL da escola). Omitido = mantém o da aula.
  startTime?: string;
}

// Nova data/hora de UMA aula quando o admin muda o dia (em dias) e/ou o
// horário de várias aulas de uma vez. Trabalha na hora LOCAL da escola pra que
// "15:00" continue sendo 15:00 depois da mudança, independente do fuso.
export function shiftLesson(
  scheduledAt: Date,
  change: LessonShift,
  offsetHours: number,
): Date {
  const { year, month, day } = toLocalParts(scheduledAt, offsetHours);
  const local = new Date(scheduledAt.getTime() + offsetHours * HOUR_MS);
  const [hours, minutes] = change.startTime
    ? parseStartTime(change.startTime)
    : [local.getUTCHours(), local.getUTCMinutes()];

  return new Date(
    Date.UTC(
      year,
      month,
      day + (change.shiftDays ?? 0),
      hours - offsetHours,
      minutes,
      0,
      0,
    ),
  );
}
