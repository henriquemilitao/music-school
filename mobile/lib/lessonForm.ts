// lib/lessonForm.ts
//
// Lógica PURA dos formulários de aula (editar uma, criar, editar várias).
// Sem React nem rede: testável com um script simples e reaproveitada pelas
// telas.

import {
  CANCEL_REASON_MAX_LENGTH,
  type BulkLessonChanges,
  type CreateLessonBody,
  type LessonStatus,
  type StudentLesson,
  type UpdateLessonBody,
} from './lessonTypes';
import { dateToText, isValidTime, parseDate, textToDate } from './newStudent';

// ─── Data e hora do formulário ────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');

export function timeToText(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "04/11/2026" + "15:30" -> Date no fuso do aparelho (null se algum for inválido)
export function combineDateTime(dateText: string, timeText: string) {
  const day = textToDate(dateText);
  if (!day || !isValidTime(timeText)) return null;
  const [hours, minutes] = timeText.split(':').map(Number);
  day.setHours(hours, minutes, 0, 0);
  return day;
}

// ─── Formulário de UMA aula (editar / criar) ──────────────────────────

export type LessonForm = {
  status: LessonStatus;
  cancelReason: string;
  date: string; // DD/MM/AAAA ('' = não escolhida)
  time: string; // HH:mm ('' = não escolhido)
  durationMinutes: number;
  // instrumento que vale pra esta aula (o da aula ou, se não tiver, o do aluno)
  instrument: string | null;
  teacherId: string | null;
};

export type LessonFormErrors = Partial<
  Record<'date' | 'time' | 'durationMinutes' | 'cancelReason', string>
>;

export function lessonToForm(
  lesson: StudentLesson,
  studentInstrument: string | null,
): LessonForm {
  const scheduled = new Date(lesson.scheduledAt);
  return {
    status: lesson.status,
    cancelReason: lesson.cancelReason ?? '',
    date: dateToText(scheduled),
    time: timeToText(scheduled),
    durationMinutes: lesson.durationMinutes,
    instrument: lesson.instrument ?? studentInstrument,
    teacherId: lesson.teacherId,
  };
}

// Reagendar: se uma aula cancelada (ou já realizada) ganha uma data futura e
// a situação não foi mexida à mão, ela volta sozinha para "Agendada" —
// é o que o admin quer quando "passa a aula para o próximo dia".
export function rescheduledStatus(
  initial: LessonForm,
  draft: Partial<LessonForm>,
  now: number,
): LessonStatus | null {
  if (draft.status !== undefined) return null; // escolheu a situação à mão
  if (initial.status === 'SCHEDULED') return null;

  const date = draft.date ?? initial.date;
  const time = draft.time ?? initial.time;
  if (date === initial.date && time === initial.time) return null;

  const when = combineDateTime(date, time);
  return when && when.getTime() > now ? 'SCHEDULED' : null;
}

export function isLessonFormDirty(initial: LessonForm, form: LessonForm) {
  return (Object.keys(initial) as (keyof LessonForm)[]).some((key) => {
    // o motivo só conta enquanto a aula está cancelada
    if (key === 'cancelReason' && form.status !== 'CANCELLED') return false;
    return initial[key] !== form[key];
  });
}

export function validateLessonForm(form: LessonForm): LessonFormErrors {
  const errors: LessonFormErrors = {};
  if (!parseDate(form.date)) errors.date = 'Escolha a data da aula';
  if (!isValidTime(form.time)) errors.time = 'Informe o horário (ex: 15:00)';
  if (form.durationMinutes < 15 || form.durationMinutes > 240) {
    errors.durationMinutes = 'Duração entre 15 e 240 minutos';
  }
  if (form.cancelReason.trim().length > CANCEL_REASON_MAX_LENGTH) {
    errors.cancelReason = `No máximo ${CANCEL_REASON_MAX_LENGTH} caracteres`;
  }
  return errors;
}

// Só o que mudou. Instrumento igual ao do aluno volta a "seguir o aluno" (null).
export function buildLessonPatch(
  lesson: StudentLesson,
  initial: LessonForm,
  form: LessonForm,
  studentInstrument: string | null,
): UpdateLessonBody {
  const body: UpdateLessonBody = {};

  if (form.status !== initial.status) body.status = form.status;
  if (
    form.status === 'CANCELLED' &&
    form.cancelReason.trim() !== initial.cancelReason.trim()
  ) {
    body.cancelReason = form.cancelReason.trim();
  }

  if (form.date !== initial.date || form.time !== initial.time) {
    const when = combineDateTime(form.date, form.time);
    if (when) body.scheduledAt = when.toISOString();
  }
  if (form.durationMinutes !== initial.durationMinutes) {
    body.durationMinutes = form.durationMinutes;
  }
  if (form.teacherId !== initial.teacherId) body.teacherId = form.teacherId;

  const nextInstrument =
    form.instrument === studentInstrument ? null : form.instrument;
  if (nextInstrument !== lesson.instrument) body.instrument = nextInstrument;

  return body;
}

// Aula nova: já vem com o que se sabe (aluno, instrumento, professor,
// duração); dia e horário ficam vazios pra serem preenchidos.
export function newLessonForm(defaults: {
  instrument: string | null;
  teacherId: string | null;
  durationMinutes: number;
}): LessonForm {
  return {
    status: 'SCHEDULED',
    cancelReason: '',
    date: '',
    time: '',
    durationMinutes: defaults.durationMinutes,
    instrument: defaults.instrument,
    teacherId: defaults.teacherId,
  };
}

export function buildCreateBody(
  form: LessonForm,
  context: {
    studentId: string;
    enrollmentId: string | null;
    studentInstrument: string | null;
  },
): CreateLessonBody | null {
  const when = combineDateTime(form.date, form.time);
  if (!when) return null;
  return {
    studentId: context.studentId,
    enrollmentId: context.enrollmentId ?? undefined,
    teacherId: form.teacherId ?? undefined,
    instrument:
      form.instrument && form.instrument !== context.studentInstrument
        ? form.instrument
        : undefined,
    scheduledAt: when.toISOString(),
    durationMinutes: form.durationMinutes,
  };
}

// ─── Edição em lote ───────────────────────────────────────────────────

export type BulkEditForm = {
  status: LessonStatus | null; // null = manter
  cancelReason: string;
  shiftDays: number; // 0 = manter o dia
  time: string; // '' = manter o horário
  durationMinutes: number | null;
  instrument: string | null;
  teacherId: string | null;
};

export const EMPTY_BULK_FORM: BulkEditForm = {
  status: null,
  cancelReason: '',
  shiftDays: 0,
  time: '',
  durationMinutes: null,
  instrument: null,
  teacherId: null,
};

export const MAX_SHIFT_DAYS = 366;

export function hasBulkChange(form: BulkEditForm) {
  return (
    form.status !== null ||
    form.shiftDays !== 0 ||
    form.time !== '' ||
    form.durationMinutes !== null ||
    form.instrument !== null ||
    form.teacherId !== null
  );
}

export function validateBulkForm(form: BulkEditForm): { time?: string } {
  if (form.time !== '' && !isValidTime(form.time)) {
    return { time: 'Informe o horário (ex: 15:00) ou deixe em branco' };
  }
  return {};
}

export function buildBulkChanges(form: BulkEditForm): BulkLessonChanges {
  const changes: BulkLessonChanges = {};
  if (form.status !== null) changes.status = form.status;
  if (form.status === 'CANCELLED' && form.cancelReason.trim()) {
    changes.cancelReason = form.cancelReason.trim();
  }
  if (form.shiftDays !== 0) changes.shiftDays = form.shiftDays;
  if (form.time !== '') changes.startTime = form.time;
  if (form.durationMinutes !== null) {
    changes.durationMinutes = form.durationMinutes;
  }
  if (form.instrument !== null) changes.instrument = form.instrument;
  if (form.teacherId !== null) changes.teacherId = form.teacherId;
  return changes;
}

// Passar as aulas para outro dia da semana, sem sair da semana da primeira
// aula (a base de todas as outras; a semana vai de segunda a domingo):
//  • aulas de quinta → quarta: volta 1 dia, na mesma semana;
//  • sexta → quarta, hoje terça: a quarta é amanhã, fica nesta semana;
//  • se esse dia (no horário da aula) já passou, só resta a semana seguinte.
// Aulas que já aconteceram (correção de histórico) nunca pulam de semana.
// O mesmo número de dias vale para todas as aulas escolhidas.
export function sameWeekShiftDays(params: {
  firstLessonIso: string;
  targetWeekday: number; // 0 = dom ... 6 = sáb
  time?: string; // novo horário ('' = o de cada aula)
  now: number;
}) {
  const { firstLessonIso, targetWeekday, time = '', now } = params;
  const first = new Date(firstLessonIso);
  const mondayFirst = (weekday: number) => (weekday + 6) % 7;

  let days = mondayFirst(targetWeekday) - mondayFirst(first.getDay());
  const landing = shiftedDate(firstLessonIso, days, time);
  if (first.getTime() >= now && landing.getTime() < now) days += 7;
  return days;
}

// Dia da semana pra onde as aulas vão com `shiftDays` (null = continua o mesmo)
export function shiftTargetWeekday(weekday: number, shiftDays: number) {
  if (shiftDays % 7 === 0) return null;
  return (((weekday + shiftDays) % 7) + 7) % 7;
}

// Dia da semana comum às aulas escolhidas (null se forem de dias diferentes)
export function commonWeekday(lessons: Pick<StudentLesson, 'scheduledAt'>[]) {
  const days = new Set(lessons.map((l) => new Date(l.scheduledAt).getDay()));
  return days.size === 1 ? [...days][0] : null;
}

// Como a aula fica depois de "mover N dias" e/ou "novo horário" (no fuso do
// aparelho; o servidor aplica a mesma conta no fuso da escola).
export function shiftedDate(iso: string, shiftDays: number, time: string) {
  const date = new Date(iso);
  const [hours, minutes] = isValidTime(time)
    ? time.split(':').map(Number)
    : [date.getHours(), date.getMinutes()];
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + shiftDays,
    hours,
    minutes,
  );
}
