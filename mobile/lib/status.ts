export type PaymentStatus = 'PENDING' | 'OVERDUE' | 'PAID';
export type LessonStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

// status "efetivo" pra exibição — combina o status do banco com o
// tempo real (in_progress / recently_finished não existem no banco,
// só existem enquanto o cron ainda não rodou)
export type EffectiveLessonStatus =
  LessonStatus | 'IN_PROGRESS' | 'RECENTLY_FINISHED';

export type StatusVisual = {
  label: string;
  colorText: string;
  colorBg: string;
};

const COLORS = {
  green: { colorText: '#16A34A', colorBg: '#F0FDF4' },
  red: { colorText: '#DC2626', colorBg: '#FEF2F2' },
  amber: { colorText: '#D97706', colorBg: '#FFFBEB' },
  purple: { colorText: '#7E22CE', colorBg: '#FAF5FF' },
  gray: { colorText: '#6B7280', colorBg: '#F3F4F6' },
  gold: { colorText: '#B08D57', colorBg: '#F3EADD' },
} as const;

export function paymentStatusConfig(status: PaymentStatus): StatusVisual {
  switch (status) {
    case 'PAID':
      return { label: 'Paga', ...COLORS.green };
    case 'OVERDUE':
      return { label: 'Atrasada', ...COLORS.red };
    case 'PENDING':
      return { label: 'Pendente', ...COLORS.amber };
    default:
      return { label: status, ...COLORS.gray };
  }
}

// Aula tem uma regra extra: reposição (isMakeup) tem prioridade
// visual sobre o status normal, senão vira roxo mesmo já concluída.
export function lessonStatusConfig(
  status: EffectiveLessonStatus,
  isMakeup: boolean,
): StatusVisual {
  if (isMakeup && status !== 'IN_PROGRESS' && status !== 'RECENTLY_FINISHED') {
    return { label: 'Reposição', ...COLORS.purple };
  }

  switch (status) {
    case 'IN_PROGRESS':
      return { label: '🎵 Em andamento', ...COLORS.gold };
    case 'RECENTLY_FINISHED':
      return { label: 'Aula concluída', ...COLORS.gray };
    case 'COMPLETED':
      return { label: '✓ Realizada', ...COLORS.green };
    case 'CANCELLED':
      return { label: 'Falta', ...COLORS.red };
    case 'SCHEDULED':
      return { label: 'Agendada', ...COLORS.amber };
    default:
      return { label: status, ...COLORS.gray };
  }
}

// Combina o status do banco com a fase ao vivo calculada por
// useLessonStatus. Use isso em qualquer tela que precise mostrar o
// status "real" de uma aula (lista, detalhe, dashboard) — assim as
// 3 telas nunca ficam dessincronizadas entre si.
export function getEffectiveLessonStatus(
  dbStatus: LessonStatus,
  livePhase:
    'upcoming' | 'in_progress' | 'recently_finished' | 'finished' | undefined,
): EffectiveLessonStatus {
  if (dbStatus !== 'SCHEDULED') return dbStatus;
  if (livePhase === 'in_progress') return 'IN_PROGRESS';
  if (livePhase === 'recently_finished') return 'RECENTLY_FINISHED';
  return dbStatus;
}
