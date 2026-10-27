// lib/newStudent.ts
//
// Regras do cadastro de aluno pelo admin (tela app/new-student.tsx):
// formato do formulário, máscaras, validação por etapa e montagem do corpo
// de POST /users/full. Fica fora da tela pra que a lógica (datas, valores,
// obrigatoriedade) seja a mesma em qualquer etapa e fácil de revisar.

import type { InstrumentValue } from './instrument';

export type HolderType = 'SELF' | 'GUARDIAN';

export type NewStudentForm = {
  // Etapa 1 — aluno
  studentName: string;
  instrument: InstrumentValue | null;
  birthDate: string; // DD/MM/AAAA (opcional)
  notes: string;
  // Etapa 2 — matrícula
  // undefined = o admin ainda não mexeu (usa o professor padrão);
  // null = escolheu "Definir depois".
  teacherId: string | null | undefined;
  firstLessonDate: string; // DD/MM/AAAA
  startTime: string; // HH:MM
  durationMinutes: number;
  monthlyAmountDigits: string; // centavos, só dígitos ("25000" = R$ 250,00)
  firstPaymentDueDate: string; // DD/MM/AAAA (opcional)
  firstPaymentPaid: boolean;
  // Etapa 3 — acesso ao app
  holder: HolderType;
  guardianName: string;
  email: string;
  phone: string; // (11) 99999-9999 (opcional)
};

export const EMPTY_FORM: NewStudentForm = {
  studentName: '',
  instrument: null,
  birthDate: '',
  notes: '',
  teacherId: undefined,
  firstLessonDate: '',
  startTime: '',
  durationMinutes: 60,
  monthlyAmountDigits: '',
  firstPaymentDueDate: '',
  firstPaymentPaid: false,
  holder: 'SELF',
  guardianName: '',
  email: '',
  phone: '',
};

export const DURATION_OPTIONS = [30, 45, 60, 90] as const;
export const NOTES_MAX_LENGTH = 500;

export type FormErrors = Partial<Record<keyof NewStudentForm, string>>;

// ─── Máscaras ────────────────────────────────────────────────────────

const onlyDigits = (text: string) => text.replace(/\D/g, '');

export function maskDate(text: string): string {
  const d = onlyDigits(text).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function maskTime(text: string): string {
  const d = onlyDigits(text).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function maskPhone(text: string): string {
  const d = onlyDigits(text).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskMoneyDigits(text: string): string {
  // Sem zeros à esquerda e no máximo R$ 999.999,99.
  return onlyDigits(text).replace(/^0+/, '').slice(0, 8);
}

// "25000" -> "250,00" | "1234567" -> "12.345,67" (sem o "R$")
export function formatMoneyDigits(digits: string): string {
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const intPart = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intPart},${cents}`;
}

// "25000" -> "250.00" (formato que a API espera)
export function moneyDigitsToApi(digits: string): string {
  const padded = digits.padStart(3, '0');
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

// ─── Datas ───────────────────────────────────────────────────────────

// "15/03/2026" -> "2026-03-15"; null se estiver incompleta ou não existir
// no calendário (ex: 31/02).
export function parseDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!valid) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isValidTime(text: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(text);
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

// Dia da semana de uma data DD/MM/AAAA (o mesmo cálculo que a API faz
// pra definir o dia fixo das aulas).
export function weekdayName(dateText: string): string | null {
  const iso = parseDate(dateText);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

// "02/11/2026" -> "seg, 02/11/2026" (null se a data for inválida)
export function dateWithWeekdayShort(dateText: string): string | null {
  const iso = parseDate(dateText);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[day]}, ${dateText}`;
}

// "02/11/2026" -> "02/11/2026 (segunda-feira)"
export function dateWithWeekdayLong(dateText: string): string {
  const weekday = weekdayName(dateText);
  return weekday ? `${dateText} (${weekday})` : dateText;
}

// Date (do seletor) <-> "DD/MM/AAAA", sempre pelo calendário local.
export function dateToText(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function textToDate(text: string): Date | null {
  const iso = parseDate(text);
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// "20/03/2015" -> "11 anos" | "7 meses" | "1 ano" (null se inválida)
export function ageText(birthText: string, now = new Date()): string | null {
  const birth = textToDate(birthText);
  if (!birth) return null;
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 ano' : `${years} anos`;
}

function isFutureDate(iso: string): boolean {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso > todayIso;
}

// ─── Validação por etapa ─────────────────────────────────────────────

export const STEP_LABELS = ['Aluno', 'Aulas', 'Acesso', 'Revisão'] as const;
export const LAST_STEP = STEP_LABELS.length - 1;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateStep(step: number, form: NewStudentForm): FormErrors {
  const errors: FormErrors = {};

  if (step === 0) {
    if (!form.studentName.trim()) {
      errors.studentName = 'Informe o nome do aluno';
    }
    if (form.birthDate) {
      const iso = parseDate(form.birthDate);
      if (!iso) errors.birthDate = 'Data inválida. Use DD/MM/AAAA';
      else if (isFutureDate(iso)) {
        errors.birthDate = 'A data de nascimento não pode ser no futuro';
      }
    }
  }

  if (step === 1) {
    if (!parseDate(form.firstLessonDate)) {
      errors.firstLessonDate = form.firstLessonDate
        ? 'Data inválida. Use DD/MM/AAAA'
        : 'Informe a data da primeira aula';
    }
    if (!isValidTime(form.startTime)) {
      errors.startTime = form.startTime
        ? 'Horário inválido. Use HH:MM (ex: 15:00)'
        : 'Informe o horário da aula';
    }
    if (!form.monthlyAmountDigits || Number(form.monthlyAmountDigits) <= 0) {
      errors.monthlyAmountDigits = 'Informe o valor da mensalidade';
    }
    if (form.firstPaymentDueDate && !parseDate(form.firstPaymentDueDate)) {
      errors.firstPaymentDueDate = 'Data inválida. Use DD/MM/AAAA';
    }
  }

  if (step === 2) {
    if (form.holder === 'GUARDIAN' && !form.guardianName.trim()) {
      errors.guardianName = 'Informe o nome do responsável';
    }
    if (!form.email.trim()) {
      errors.email = 'Informe o e-mail para enviar o convite';
    } else if (!EMAIL_RE.test(form.email.trim())) {
      errors.email = 'E-mail inválido. Confira e tente de novo';
    }
    if (form.phone && onlyDigits(form.phone).length < 10) {
      errors.phone = 'Telefone incompleto. Inclua o DDD';
    }
  }

  return errors;
}

// Etapa mais antiga com erro (usada no envio final, por segurança).
export function firstInvalidStep(form: NewStudentForm): number | null {
  for (let step = 0; step <= 2; step++) {
    if (Object.keys(validateStep(step, form)).length) return step;
  }
  return null;
}

// Rascunho com algum campo preenchido? (pra pedir confirmação ao sair)
export function isFormDirty(form: NewStudentForm): boolean {
  return (
    JSON.stringify({ ...form, teacherId: undefined, durationMinutes: 60 }) !==
    JSON.stringify(EMPTY_FORM)
  );
}

// ─── Corpo da requisição ─────────────────────────────────────────────

export type CreateFullUserBody = {
  name: string;
  email: string;
  phone?: string;
  role: 'STUDENT';
  students: {
    name: string;
    birthDate?: string;
    instrument?: InstrumentValue;
    notes?: string;
    enrollment: {
      teacherId?: string;
      startTime: string;
      durationMinutes: number;
      monthlyAmount: string;
      firstLessonDate: string;
      firstPaymentDueDate?: string;
      firstPaymentPaid: boolean;
    };
  }[];
};

export function buildCreateBody(
  form: NewStudentForm,
  teacherId: string | null,
): CreateFullUserBody {
  const studentName = form.studentName.trim();
  const phoneDigits = onlyDigits(form.phone);

  return {
    // Quando o próprio aluno acessa o app, o titular da conta é ele mesmo.
    name: form.holder === 'SELF' ? studentName : form.guardianName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: phoneDigits || undefined,
    role: 'STUDENT',
    students: [
      {
        name: studentName,
        birthDate: parseDate(form.birthDate) ?? undefined,
        instrument: form.instrument ?? undefined,
        notes: form.notes.trim() || undefined,
        enrollment: {
          teacherId: teacherId ?? undefined,
          startTime: form.startTime,
          durationMinutes: form.durationMinutes,
          monthlyAmount: moneyDigitsToApi(form.monthlyAmountDigits),
          firstLessonDate: parseDate(form.firstLessonDate) as string,
          firstPaymentDueDate: parseDate(form.firstPaymentDueDate) ?? undefined,
          firstPaymentPaid: form.firstPaymentPaid,
        },
      },
    ],
  };
}
