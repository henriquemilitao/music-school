// lib/lessonNotes.ts
//
// Regras das anotações da aula (o que foi trabalhado, o que estudar).
// O admin/professor escreve e o aluno vê no app dele.

// Mesmo limite do backend (backend/src/lessons/lessons.constants.ts) —
// se mudar lá, muda aqui.
export const LESSON_NOTES_MAX_LENGTH = 5000;

// A partir daqui o contador de caracteres aparece no editor. Abaixo
// disso ele só polui a tela.
export const LESSON_NOTES_COUNTER_FROM = 4000;

export const LESSON_NOTES_PLACEHOLDER =
  'O que trabalhamos hoje...\n\nPara estudar em casa...';
