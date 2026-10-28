// Tamanho máximo das anotações da aula. O app usa o mesmo valor
// (mobile/lib/lessonNotes.ts) pra travar o campo e mostrar o contador —
// se mudar aqui, muda lá também.
export const LESSON_NOTES_MAX_LENGTH = 5000;

// Duração aceita pra uma aula (minutos)
export const LESSON_MIN_DURATION_MINUTES = 15;
export const LESSON_MAX_DURATION_MINUTES = 240;

// Motivo do cancelamento (texto livre, opcional)
export const LESSON_CANCEL_REASON_MAX_LENGTH = 300;

// Quantas aulas dá pra editar/excluir de uma vez
export const LESSON_BULK_MAX = 100;

// Limite do deslocamento de dias na edição em lote (±1 ano)
export const LESSON_MAX_SHIFT_DAYS = 366;
