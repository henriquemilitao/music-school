// lib/lessonTypes.ts
//
// Tipos das aulas na visão do admin e dos corpos das requisições. Só tipos
// e constantes — sem React, sem rede — pra serem usados por qualquer módulo.

import type { LessonStatus } from './status';

export type { LessonStatus };

// Resumo de uma aula ligada à outra por reposição
export type LessonLink = {
  id: string;
  scheduledAt: string;
  status: LessonStatus;
};

// Aula como vem na lista do aluno (GET /lessons/student/:id)
export type StudentLesson = {
  id: string;
  studentId: string;
  teacherId: string | null;
  enrollmentId: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: LessonStatus;
  isMakeup: boolean;
  // null = segue o instrumento do aluno
  instrument: string | null;
  notes: string | null;
  cancelReason: string | null;
  // aula cancelada que esta repõe (quando isMakeup)
  makeupFor: LessonLink | null;
  // reposições marcadas pra esta aula (quando cancelada)
  makeups: LessonLink[];
  teacher: { user: { name: string } } | null;
};

// Detalhe (GET /lessons/:id): a mesma aula + aluno e anotações
export type AdminLesson = StudentLesson & {
  notesUpdatedAt: string | null;
  student: { id: string; name: string; instrument: string | null };
};

export type TeacherOption = { id: string; user: { name: string } };

// Mesmo texto que o backend grava ao encerrar a matrícula
// (backend/src/enrollments/enrollment-management.service.ts)
export const ENROLLMENT_ENDED_REASON = 'Matrícula encerrada';

export const CANCEL_REASON_MAX_LENGTH = 300;

// ─── Corpos das requisições ───────────────────────────────────────────

export type UpdateLessonBody = {
  status?: LessonStatus;
  cancelReason?: string | null;
  scheduledAt?: string;
  durationMinutes?: number;
  teacherId?: string | null;
  instrument?: string | null;
  isMakeup?: boolean;
  makeupForLessonId?: string | null;
};

export type MakeupInput = {
  scheduledAt: string;
  durationMinutes?: number;
  teacherId?: string;
  instrument?: string;
};

export type CancelLessonBody = {
  cancelReason?: string;
  makeup?: MakeupInput;
};

export type CreateLessonBody = {
  studentId: string;
  enrollmentId?: string;
  teacherId?: string;
  instrument?: string;
  scheduledAt: string;
  durationMinutes?: number;
  isMakeup?: boolean;
  makeupForLessonId?: string;
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
