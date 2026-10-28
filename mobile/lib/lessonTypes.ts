// lib/lessonTypes.ts
//
// Tipos das aulas na visão do admin e dos corpos das requisições. Só tipos
// e constantes — sem React, sem rede — pra serem usados por qualquer módulo.

import type { LessonStatus } from './status';

export type { LessonStatus };

// Aula como vem na lista do aluno (GET /lessons/student/:id)
export type StudentLesson = {
  id: string;
  studentId: string;
  teacherId: string | null;
  enrollmentId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: LessonStatus;
  // null = segue o instrumento do aluno
  instrument: string | null;
  notes: string | null;
  cancelReason: string | null;
  teacher: { user: { name: string } } | null;
};

// Detalhe (GET /lessons/:id): a mesma aula + aluno e anotações
export type AdminLesson = StudentLesson & {
  notesUpdatedAt: string | null;
  student: { id: string; name: string; instrument: string | null };
};

export type TeacherOption = { id: string; user: { name: string } };

export const CANCEL_REASON_MAX_LENGTH = 300;

// ─── Corpos das requisições ───────────────────────────────────────────

export type UpdateLessonBody = {
  status?: LessonStatus;
  cancelReason?: string | null;
  scheduledAt?: string;
  durationMinutes?: number;
  teacherId?: string | null;
  instrument?: string | null;
};

export type CreateLessonBody = {
  studentId: string;
  enrollmentId?: string;
  teacherId?: string;
  instrument?: string;
  scheduledAt: string;
  durationMinutes?: number;
};

export type BulkLessonChanges = {
  status?: LessonStatus;
  cancelReason?: string;
  teacherId?: string;
  instrument?: string;
  durationMinutes?: number;
  shiftDays?: number;
  startTime?: string;
};
