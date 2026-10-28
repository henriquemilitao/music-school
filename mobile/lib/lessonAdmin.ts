// lib/lessonAdmin.ts
//
// Chamadas à API de aulas (admin), cache do React Query e hooks de dados.
// Tipos em lessonTypes.ts; lógica de formulário em lessonForm.ts.

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  AdminLesson,
  BulkLessonChanges,
  CancelLessonBody,
  CreateLessonBody,
  StudentLesson,
  TeacherOption,
  UpdateLessonBody,
} from './lessonTypes';
import { adminLessonKeys } from './queryKeys';

// ─── Chamadas ─────────────────────────────────────────────────────────

export async function fetchStudentLessons(studentId: string) {
  const response = await api.get<StudentLesson[]>(
    `/lessons/student/${studentId}`,
  );
  return response.data;
}

export async function updateLesson(lessonId: string, body: UpdateLessonBody) {
  const response = await api.patch<AdminLesson>(`/lessons/${lessonId}`, body);
  return response.data;
}

export async function cancelLesson(lessonId: string, body: CancelLessonBody) {
  const response = await api.post<{
    lesson: AdminLesson;
    makeup: AdminLesson | null;
  }>(`/lessons/${lessonId}/cancel`, body);
  return response.data;
}

export async function createLesson(body: CreateLessonBody) {
  const response = await api.post<AdminLesson>('/lessons', body);
  return response.data;
}

export async function deleteLesson(lessonId: string) {
  await api.delete(`/lessons/${lessonId}`);
}

export async function bulkUpdateLessons(
  lessonIds: string[],
  changes: BulkLessonChanges,
) {
  const response = await api.patch<{ updatedCount: number }>('/lessons/bulk', {
    lessonIds,
    changes,
  });
  return response.data;
}

export async function bulkDeleteLessons(lessonIds: string[]) {
  const response = await api.post<{ deletedCount: number }>(
    '/lessons/bulk-delete',
    { lessonIds },
  );
  return response.data;
}

// ─── Hooks de dados ───────────────────────────────────────────────────

export function useStudentLessons(studentId: string, enabled = true) {
  return useQuery({
    queryKey: adminLessonKeys.byStudent(studentId),
    queryFn: () => fetchStudentLessons(studentId),
    enabled: !!studentId && enabled,
  });
}

export function useAdminLesson(lessonId: string) {
  return useQuery({
    queryKey: adminLessonKeys.detail(lessonId),
    queryFn: async () =>
      (await api.get<AdminLesson>(`/lessons/${lessonId}`)).data,
    enabled: !!lessonId,
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => (await api.get<TeacherOption[]>('/teachers')).data,
  });
}

// Depois de mudar aulas: atualiza a aba do aluno, a agenda e o detalhe de
// cada aula tocada.
export function useRefreshLessons() {
  const queryClient = useQueryClient();

  return (studentId: string, lessonIds: string[] = []) => {
    queryClient.invalidateQueries({
      queryKey: adminLessonKeys.byStudent(studentId),
    });
    queryClient.invalidateQueries({ queryKey: adminLessonKeys.schedule() });
    lessonIds.forEach((lessonId) =>
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.detail(lessonId),
      }),
    );
  };
}
