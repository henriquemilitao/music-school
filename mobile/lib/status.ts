// Fonte única de verdade pra cor e label de qualquer "status" no
// app: status de pagamento (Payment.status) e status de aula
// (Lesson.status). Antes cada tela tinha sua própria função
// statusConfig/lessonStatusConfig reimplementada na mão (em
// payments.tsx, payment.tsx, payment-detail/[id].tsx,
// payment-bundle/[id].tsx, lessons.tsx, lesson/[id].tsx), o que é
// exatamente o motivo dos bugs de layout terem se espalhado por
// tantos lugares diferentes. Agora é só um lugar pra manter.

export type PaymentStatus = 'PENDING' | 'OVERDUE' | 'PAID';
export type LessonStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

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
  status: LessonStatus,
  isMakeup: boolean,
): StatusVisual {
  if (isMakeup) return { label: 'Reposição', ...COLORS.purple };

  switch (status) {
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
