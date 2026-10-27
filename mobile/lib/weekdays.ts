// Dias da semana na numeração do backend (0 = domingo ... 6 = sábado).
export const WEEKDAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

export const WEEKDAY_SHORT = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
] as const;

export const WEEKDAY_OPTIONS = WEEKDAY_SHORT.map((label, value) => ({
  value,
  label,
}));
