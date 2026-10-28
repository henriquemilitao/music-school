// lib/studentAdmin.ts
//
// Tudo que as telas de administração do aluno (editar, encerrar, excluir)
// usam pra falar com a API: tipos, chamadas e invalidação de cache.
import { useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { adminLessonKeys } from './queryKeys';

// ─── Tipos ────────────────────────────────────────────────────────────

export type UpcomingLesson = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  isMakeup: boolean;
};

export type ScheduleChange = {
  weekDay?: number;
  startTime?: string;
  durationMinutes?: number;
};

export type SchedulePreview = {
  total: number;
  lessons: {
    lessonId: string;
    from: string;
    to: string;
    fromDurationMinutes: number;
    toDurationMinutes: number;
  }[];
};

// O que o servidor sugere para uma fatura (a tela não pré-seleciona: tudo
// começa como "manter")
export type PaymentSuggestion = 'KEEP' | 'DELETE';

// O que o admin escolhe: manter como está, apagar (estornar, se paga) ou
// dizer que a fatura em aberto já foi paga
export type PaymentDecision = 'KEEP' | 'DELETE' | 'MARK_PAID';

// Como encerrar: agora, a partir de uma aula ou ao fim de uma fatura
export type EndMode = 'NOW' | 'FROM_LESSON' | 'AFTER_INVOICE';

export type EndTarget = {
  mode: EndMode;
  fromLessonId?: string;
  afterPaymentId?: string;
};

// Fatura com o período de aulas que ela cobre (datas "AAAA-MM-DD")
export type InvoiceOption = {
  id: string;
  referenceMonth: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
  periodStart: string | null;
  periodLastDay: string | null;
};

export type EndOptions = {
  payments: InvoiceOption[];
  olderPaymentsCount: number;
};

// Fatura sobre a qual o encerramento age
export type EndPaymentOption = InvoiceOption & {
  // Aulas do ciclo da fatura que serão canceladas / que continuam valendo
  lessonsCancelled: number;
  lessonsRemaining: number;
  suggestion: PaymentSuggestion;
  // true = será apagada sem escolha (fatura depois da escolhida)
  locked: boolean;
  // true = o admin pode escolher apagar (encerrar agora / a partir de uma aula)
  deletable: boolean;
};

export type EndPreview = {
  mode: EndMode;
  cutoff: string;
  // null = o aluno fica inativo agora; data = segue ativo até lá
  endsAt: string | null;
  lessonsCancelled: number;
  lessonsKept: number;
  olderPaymentsCount: number;
  payments: EndPaymentOption[];
};

export type EndEnrollmentBody = EndTarget & {
  deletePaymentIds?: string[];
  markPaidPaymentIds?: string[];
};

// Corpo do PATCH /enrollments/:id — só o que mudou
export type UpdateEnrollmentBody = {
  instrument?: string;
  teacherId?: string;
  monthlyAmount?: string;
  durationMinutes?: number;
  weekDay?: number;
  startTime?: string;
  paymentDueDay?: number;
  applyFromLessonId?: string;
};

export type UpdateProfileBody = {
  name?: string;
  birthDate?: string;
  guardianName?: string;
  guardianEmail?: string;
  guardianPhone?: string;
};

// ─── Chaves de cache ─────────────────────────────────────────────────

export const studentAdminKeys = {
  upcoming: (enrollmentId: string) =>
    ['admin-enrollment-upcoming', enrollmentId] as const,
  schedulePreview: (
    enrollmentId: string,
    fromLessonId: string,
    change: ScheduleChange,
  ) =>
    [
      'admin-enrollment-schedule-preview',
      enrollmentId,
      fromLessonId,
      change.weekDay,
      change.startTime,
      change.durationMinutes,
    ] as const,
  endOptions: (enrollmentId: string) =>
    ['admin-enrollment-end-options', enrollmentId] as const,
  endPreview: (enrollmentId: string, target: EndTarget) =>
    [
      'admin-enrollment-end-preview',
      enrollmentId,
      target.mode,
      target.fromLessonId,
      target.afterPaymentId,
    ] as const,
};

// ─── Chamadas ─────────────────────────────────────────────────────────

export async function fetchUpcomingLessons(enrollmentId: string) {
  const response = await api.get<UpcomingLesson[]>(
    `/enrollments/${enrollmentId}/upcoming-lessons`,
  );
  return response.data;
}

export async function fetchSchedulePreview(
  enrollmentId: string,
  fromLessonId: string,
  change: ScheduleChange,
) {
  const response = await api.get<SchedulePreview>(
    `/enrollments/${enrollmentId}/schedule-preview`,
    { params: { fromLessonId, ...change } },
  );
  return response.data;
}

export async function fetchEndOptions(enrollmentId: string) {
  const response = await api.get<EndOptions>(
    `/enrollments/${enrollmentId}/end-options`,
  );
  return response.data;
}

export async function fetchEndPreview(enrollmentId: string, target: EndTarget) {
  const response = await api.get<EndPreview>(
    `/enrollments/${enrollmentId}/end-preview`,
    { params: target },
  );
  return response.data;
}

export async function updateEnrollment(
  enrollmentId: string,
  body: UpdateEnrollmentBody,
) {
  const response = await api.patch(`/enrollments/${enrollmentId}`, body);
  return response.data;
}

export async function endEnrollment(
  enrollmentId: string,
  body: EndEnrollmentBody,
) {
  const response = await api.post(`/enrollments/${enrollmentId}/end`, body);
  return response.data;
}

export async function updateStudentProfile(
  studentId: string,
  body: UpdateProfileBody,
) {
  const response = await api.patch(`/students/${studentId}/profile`, body);
  return response.data;
}

export async function deleteStudentPermanently(
  studentId: string,
  confirmName: string,
) {
  const response = await api.delete<{
    deleted: boolean;
    guardianDeleted: boolean;
  }>(`/students/${studentId}`, { params: { confirmName } });
  return response.data;
}

// ─── Cache ────────────────────────────────────────────────────────────

// Depois de qualquer mudança no aluno/matrícula: atualiza detalhe, lista,
// agenda, aulas e faturas. Com `removed`, apaga o aluno do cache em vez de
// recarregar (ele não existe mais).
export function useRefreshStudentData() {
  const queryClient = useQueryClient();

  return (studentId: string, options?: { removed?: boolean }) => {
    const keys: (readonly unknown[])[] = [
      ['admin-students'],
      ['admin-enrollments'],
      ['admin-pending-payments'],
      adminLessonKeys.schedule(),
    ];
    const studentKeys: (readonly unknown[])[] = [
      ['admin-student', studentId],
      ['admin-student-enrollment', studentId],
      ['admin-student-payment-status', studentId],
      ['admin-student-payments', studentId],
      adminLessonKeys.byStudent(studentId),
    ];

    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));

    if (options?.removed) {
      studentKeys.forEach((queryKey) =>
        queryClient.removeQueries({ queryKey }),
      );
    } else {
      studentKeys.forEach((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      );
    }
  };
}
