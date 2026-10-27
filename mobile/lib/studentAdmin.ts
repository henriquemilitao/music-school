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
  lessons: { lessonId: string; from: string; to: string }[];
};

export type PlannedPayment = {
  id: string;
  referenceMonth: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
};

export type EndPreview = {
  cutoff: string;
  lessonsRemoved: number;
  lessonsKept: number;
  paymentsDeleted: PlannedPayment[];
  paidPaymentsAffected: PlannedPayment[];
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
  endPreview: (enrollmentId: string, fromLessonId: string | null) =>
    ['admin-enrollment-end-preview', enrollmentId, fromLessonId] as const,
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

export async function fetchEndPreview(
  enrollmentId: string,
  fromLessonId: string | null,
) {
  const response = await api.get<EndPreview>(
    `/enrollments/${enrollmentId}/end-preview`,
    { params: fromLessonId ? { fromLessonId } : {} },
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
  fromLessonId: string | null,
) {
  const response = await api.post(
    `/enrollments/${enrollmentId}/end`,
    fromLessonId ? { fromLessonId } : {},
  );
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
