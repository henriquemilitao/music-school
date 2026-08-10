// lib/paymentUrgency.ts
//
// Fonte única de verdade pro aviso de urgência de uma fatura
// (dashboard e tela de pagamento usam o mesmo helper, pro texto
// e as cores nunca ficarem dessincronizados entre telas).

export type PaymentUrgency = {
  label: string; // "Vence em 5 dias" | "Atrasada há 3 dias" | "Vence hoje" | "Vence amanhã"
  colorText: string; // cor do texto
  colorBg: string; // cor de fundo (pra pill/badge, se quiser usar)
};

export function getPaymentUrgency(
  dueDateIso: string,
  status: 'PENDING' | 'OVERDUE' | 'PAID',
): PaymentUrgency | null {
  // fatura paga não precisa de aviso de urgência
  if (status === 'PAID') return null;

  const dueDate = new Date(dueDateIso);
  const now = new Date();

  // zera as horas pra contar em dias corridos, não em horas fracionadas
  const dueDateOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate(),
  );
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.round(
    (dueDateOnly.getTime() - nowOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

  // já venceu (ou o status já veio como OVERDUE do backend)
  if (diffDays < 0 || status === 'OVERDUE') {
    const daysLate = Math.abs(diffDays);
    return {
      label:
        daysLate === 0
          ? 'Atrasada há menos de um dia'
          : `Atrasada há ${daysLate} dia${daysLate > 1 ? 's' : ''}`,
      colorText: '#DC2626',
      colorBg: '#FEF2F2',
    };
  }

  if (diffDays === 0) {
    return { label: 'Vence hoje', colorText: '#D97706', colorBg: '#FFFBEB' };
  }

  if (diffDays === 1) {
    return {
      label: 'Vence amanhã',
      colorText: '#D97706',
      colorBg: '#FFFBEB',
    };
  }

  // perto do vencimento (dentro de uma semana) -> âmbar; longe -> verde
  const isNear = diffDays <= 7;
  return {
    label: `Vence em ${diffDays} dias`,
    // colorText: isNear ? '#D97706' : '#059669',
    // colorBg: isNear ? '#FFFBEB' : '#ECFDF5',
    colorText: '#D97706',
    colorBg: '#FFFBEB',
  };
}
