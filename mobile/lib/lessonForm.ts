// lib/lessonForm.ts
//
// Lógica PURA dos formulários de aula (editar uma, criar, cancelar com
// reposição, editar várias) e das etiquetas de reposição. Sem React nem rede:
// testável com um script simples e reaproveitada pelas telas.

import { formatLessonShortDate, formatLessonTime } from './lessonFormat';
import {
  CANCEL_REASON_MAX_LENGTH,
  ENROLLMENT_ENDED_REASON,
  type BulkLessonChanges,
  type CancelLessonBody,
  type CreateLessonBody,
  type LessonStatus,
  type StudentLesson,
  type UpdateLessonBody,
} from './lessonTypes';
import { dateToText, isValidTime, parseDate, textToDate } from './newStudent';

// ─── Reposição: tags e candidatas ─────────────────────────────────────

export type LessonTag = {
  tone: 'purple' | 'green' | 'gray';
  text: string;
  // aula pra onde a tag leva (a original ou a reposição)
  targetLessonId?: string;
};

const activeMakeup = (lesson: Pick<StudentLesson, 'makeups'>) =>
  lesson.makeups.find((makeup) => makeup.status !== 'CANCELLED');

// Etiquetas de reposição de uma aula, pra lista e pro detalhe:
//  • é reposição → "Reposição da aula de Seg, 2 de nov" (ou só "Reposição")
//  • cancelada com reposição marcada → "Reposição marcada: Qua, 4 de nov às 15:00"
//  • cancelada sem reposição → "Sem reposição prevista" (menos quando foi o
//    encerramento da matrícula que cancelou — aí não faz sentido repor)
export function lessonTags(
  lesson: Pick<
    StudentLesson,
    'isMakeup' | 'makeupFor' | 'makeups' | 'status' | 'cancelReason'
  >,
): LessonTag[] {
  const tags: LessonTag[] = [];

  if (lesson.isMakeup) {
    tags.push(
      lesson.makeupFor
        ? {
            tone: 'purple',
            text: `Reposição da aula de ${formatLessonShortDate(lesson.makeupFor.scheduledAt)}`,
            targetLessonId: lesson.makeupFor.id,
          }
        : { tone: 'purple', text: 'Reposição' },
    );
  }

  if (lesson.status === 'CANCELLED') {
    const makeup = activeMakeup(lesson);
    if (makeup) {
      tags.push({
        tone: 'green',
        text: `Reposição marcada: ${formatLessonShortDate(makeup.scheduledAt)} às ${formatLessonTime(makeup.scheduledAt)}`,
        targetLessonId: makeup.id,
      });
    } else if (lesson.cancelReason !== ENROLLMENT_ENDED_REASON) {
      tags.push({ tone: 'gray', text: 'Sem reposição prevista' });
    }
  }

  return tags;
}

// Aulas canceladas que ainda podem ganhar uma reposição (as mais recentes
// primeiro). `keepId` mantém na lista a que já está vinculada.
export function replaceableLessons(
  lessons: StudentLesson[],
  options: { excludeId?: string; keepId?: string | null; limit?: number } = {},
) {
  const { excludeId, keepId, limit = 8 } = options;
  return lessons
    .filter(
      (lesson) =>
        lesson.id !== excludeId &&
        lesson.status === 'CANCELLED' &&
        lesson.cancelReason !== ENROLLMENT_ENDED_REASON &&
        (lesson.id === keepId || !activeMakeup(lesson)),
    )
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    )
    .slice(0, limit);
}

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
  isMakeup: boolean;
  makeupForLessonId: string | null;
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
    isMakeup: lesson.isMakeup,
    makeupForLessonId: lesson.makeupFor?.id ?? null,
  };
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

  if (form.isMakeup !== initial.isMakeup) body.isMakeup = form.isMakeup;
  if (form.isMakeup && form.makeupForLessonId !== initial.makeupForLessonId) {
    body.makeupForLessonId = form.makeupForLessonId;
  }

  return body;
}

// Aula nova: já vem com o que se sabe (aluno, instrumento, professor,
// duração); dia e horário ficam vazios pra serem preenchidos.
export function newLessonForm(defaults: {
  instrument: string | null;
  teacherId: string | null;
  durationMinutes: number;
  makeupForLessonId?: string | null;
}): LessonForm {
  return {
    status: 'SCHEDULED',
    cancelReason: '',
    date: '',
    time: '',
    durationMinutes: defaults.durationMinutes,
    instrument: defaults.instrument,
    teacherId: defaults.teacherId,
    isMakeup: !!defaults.makeupForLessonId,
    makeupForLessonId: defaults.makeupForLessonId ?? null,
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
    isMakeup: form.isMakeup,
    makeupForLessonId:
      form.isMakeup && form.makeupForLessonId
        ? form.makeupForLessonId
        : undefined,
  };
}

// ─── Cancelar (com reposição opcional) ────────────────────────────────

export type MakeupDraft = {
  date: string;
  time: string;
  durationMinutes: number;
  instrument: string | null;
  teacherId: string | null;
};

export function makeupDraftFrom(
  lesson: StudentLesson,
  studentInstrument: string | null,
): MakeupDraft {
  return {
    date: '',
    time: timeToText(new Date(lesson.scheduledAt)),
    durationMinutes: lesson.durationMinutes,
    instrument: lesson.instrument ?? studentInstrument,
    teacherId: lesson.teacherId,
  };
}

export function validateMakeupDraft(
  draft: MakeupDraft,
): Pick<LessonFormErrors, 'date' | 'time'> {
  const errors: Pick<LessonFormErrors, 'date' | 'time'> = {};
  if (!parseDate(draft.date)) errors.date = 'Escolha a data da reposição';
  if (!isValidTime(draft.time)) errors.time = 'Informe o horário (ex: 15:00)';
  return errors;
}

export function buildCancelBody(
  reason: string,
  makeup: MakeupDraft | null,
  lesson: StudentLesson,
  studentInstrument: string | null,
): CancelLessonBody {
  const body: CancelLessonBody = {};
  if (reason.trim()) body.cancelReason = reason.trim();

  if (makeup) {
    const when = combineDateTime(makeup.date, makeup.time);
    if (when) {
      body.makeup = {
        scheduledAt: when.toISOString(),
        durationMinutes: makeup.durationMinutes,
        // só manda o que difere da aula cancelada (o resto o back herda)
        teacherId:
          makeup.teacherId && makeup.teacherId !== lesson.teacherId
            ? makeup.teacherId
            : undefined,
        instrument:
          makeup.instrument &&
          makeup.instrument !== (lesson.instrument ?? studentInstrument)
            ? makeup.instrument
            : undefined,
      };
    }
  }
  return body;
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

// Quantos dias pra frente vai de um dia da semana (0 = dom ... 6 = sáb) ao
// outro: segunda(1) → quarta(3) = 2; quarta(3) → segunda(1) = 5.
export function forwardShiftDays(from: number, to: number) {
  return (to - from + 7) % 7;
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
