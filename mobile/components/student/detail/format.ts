// Formatações usadas nos cartões do detalhe do aluno.

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Data de nascimento é guardada como data pura (meia-noite UTC): formatar
// em UTC evita mostrar um dia a menos em fusos negativos (Brasil).
export function formatBirthDate(iso: string) {
  return capitalize(
    new Date(iso).toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  );
}

// Ex: "10 de julho de 2014 (12 anos)"
export function formatBirthDateWithAge(
  birthDate: string | null,
  age: number | null,
) {
  if (!birthDate) return '—';
  const dateLabel = formatBirthDate(birthDate);
  return age != null ? `${dateLabel} (${age} anos)` : dateLabel;
}

// Garante o "R$" independente de como outro helper formata o número
export function formatCurrencyBRL(value: string | number) {
  const num = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
}

// Data (e dia da semana) de um encerramento agendado, no fuso do aparelho
export function formatEndsAt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
