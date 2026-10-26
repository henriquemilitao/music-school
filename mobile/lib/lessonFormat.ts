// lib/lessonFormat.ts
//
// Formatação de datas e horários de aula, no mesmo espírito do
// paymentFormat.ts: um lugar só, pra aluno e admin verem a mesma coisa.

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// "Quinta-feira, 15 de outubro de 2026"
export function formatLessonFullDate(iso: string) {
  return capitalize(
    new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
}

// "Qui, 15 de out"
export function formatLessonShortDate(iso: string) {
  const date = new Date(iso);
  const weekday = date
    .toLocaleDateString('pt-BR', { weekday: 'short' })
    .replace('.', '');
  const month = date
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  return `${capitalize(weekday)}, ${date.getDate()} de ${month}`;
}

// "15:00"
export function formatLessonTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "15:00 às 16:00"
export function formatLessonTimeRange(iso: string, durationMinutes: number) {
  const end = new Date(new Date(iso).getTime() + durationMinutes * 60_000);
  return `${formatLessonTime(iso)} às ${formatLessonTime(end.toISOString())}`;
}

// "Atualizado agora" / "Atualizado hoje às 14:32" / "Atualizado ontem às
// 09:10" / "Atualizado em 12/10 às 18:05"
export function formatNotesUpdatedAt(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (now.getTime() - date.getTime() < 60_000) return 'Atualizado agora';

  const time = formatLessonTime(iso);
  if (isSameDay(date, now)) return `Atualizado hoje às ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Atualizado ontem às ${time}`;

  const day =
    date.getFullYear() === now.getFullYear()
      ? date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : date.toLocaleDateString('pt-BR');
  return `Atualizado em ${day} às ${time}`;
}
