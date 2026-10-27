// lib/enrollmentEdit.ts
//
// Regras do formulário de edição da matrícula, sem tela nenhuma: valores
// iniciais, o que mudou e o corpo enviado à API.
import type { InstrumentValue } from './instrument';
import { isValidTime, moneyDigitsToApi } from './newStudent';
import type { UpdateEnrollmentBody } from './studentAdmin';

export type EnrollmentEditForm = {
  instrument: InstrumentValue | null;
  teacherId: string | null;
  weekDay: number; // 0=domingo ... 6=sábado
  startTime: string; // HH:MM
  durationMinutes: number;
  monthlyAmountDigits: string; // centavos, sem pontuação ("25000" = R$ 250,00)
  dueDay: number; // dia do mês do vencimento (1-31)
};

type EnrollmentSource = {
  weekDay: number;
  startTime: string;
  durationMinutes: number;
  monthlyAmount: string;
  firstPaymentDueDate: string;
  teacherId: string | null;
};

export function initialEditForm(
  enrollment: EnrollmentSource,
  instrument: string | null,
): EnrollmentEditForm {
  return {
    instrument: (instrument as InstrumentValue | null) ?? null,
    teacherId: enrollment.teacherId,
    weekDay: enrollment.weekDay,
    startTime: enrollment.startTime,
    durationMinutes: enrollment.durationMinutes,
    monthlyAmountDigits: String(
      Math.round(Number(enrollment.monthlyAmount) * 100),
    ),
    // gravado ao meio-dia UTC, então o dia UTC é sempre o dia certo
    dueDay: new Date(enrollment.firstPaymentDueDate).getUTCDate(),
  };
}

// Dia, horário ou duração mudaram? Então é preciso escolher a partir de qual
// aula vale (as aulas já geradas precisam ser ajustadas).
export function hasScheduleChange(
  initial: EnrollmentEditForm,
  form: EnrollmentEditForm,
) {
  return (
    form.weekDay !== initial.weekDay ||
    form.startTime !== initial.startTime ||
    form.durationMinutes !== initial.durationMinutes
  );
}

export function isEditFormDirty(
  initial: EnrollmentEditForm,
  form: EnrollmentEditForm,
) {
  return (
    hasScheduleChange(initial, form) ||
    form.instrument !== initial.instrument ||
    form.teacherId !== initial.teacherId ||
    form.monthlyAmountDigits !== initial.monthlyAmountDigits ||
    form.dueDay !== initial.dueDay
  );
}

// Diferença, em dias, entre o dia de vencimento antigo e o novo.
export function dueDayDistance(
  initial: EnrollmentEditForm,
  form: EnrollmentEditForm,
) {
  return Math.abs(form.dueDay - initial.dueDay);
}

// Acima disso, pedimos uma confirmação extra ("tem certeza?")
export const DUE_DAY_CONFIRM_THRESHOLD = 15;

export type EditFormErrors = Partial<
  Record<'startTime' | 'monthlyAmountDigits', string>
>;

export function validateEditForm(form: EnrollmentEditForm): EditFormErrors {
  const errors: EditFormErrors = {};
  if (!isValidTime(form.startTime)) {
    errors.startTime = 'Horário inválido. Use HH:MM (ex: 15:00)';
  }
  if (!form.monthlyAmountDigits || Number(form.monthlyAmountDigits) <= 0) {
    errors.monthlyAmountDigits = 'Informe o valor da mensalidade';
  }
  return errors;
}

// Só os campos que mudaram — o resto nem vai na requisição.
export function buildUpdateBody(
  initial: EnrollmentEditForm,
  form: EnrollmentEditForm,
  applyFromLessonId?: string,
): UpdateEnrollmentBody {
  const body: UpdateEnrollmentBody = {};
  if (form.instrument && form.instrument !== initial.instrument)
    body.instrument = form.instrument;
  if (form.teacherId && form.teacherId !== initial.teacherId)
    body.teacherId = form.teacherId;
  if (form.monthlyAmountDigits !== initial.monthlyAmountDigits)
    body.monthlyAmount = moneyDigitsToApi(form.monthlyAmountDigits);
  if (form.dueDay !== initial.dueDay) body.paymentDueDay = form.dueDay;
  if (form.weekDay !== initial.weekDay) body.weekDay = form.weekDay;
  if (form.startTime !== initial.startTime) body.startTime = form.startTime;
  if (form.durationMinutes !== initial.durationMinutes)
    body.durationMinutes = form.durationMinutes;
  if (applyFromLessonId) body.applyFromLessonId = applyFromLessonId;
  return body;
}
