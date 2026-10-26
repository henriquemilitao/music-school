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
  if (status === 'PAID') return null;

  const dueDate = new Date(dueDateIso);
  const now = new Date();

  // Usa os métodos UTC (getUTCFullYear/getUTCMonth/getUTCDate) em
  // vez dos locais (getFullYear/getMonth/getDate) — dueDateIso
  // representa um DIA CIVIL em UTC (ex: "2026-09-07T00:00:00.000Z" =
  // dia 7), não um instante que deva ser reinterpretado no fuso do
  // dispositivo. Ler com os métodos locais faria o mesmo bug de
  // "voltar 1 dia" vazar pro cálculo de diffDays abaixo, o que
  // bagunçaria tanto a contagem de dias restantes/atraso quanto o
  // texto exibido ("vence em X dias" / "atrasada há X dias").
  const dueDateOnly = new Date(
    Date.UTC(
      dueDate.getUTCFullYear(),
      dueDate.getUTCMonth(),
      dueDate.getUTCDate(),
    ),
  );

  // "now" (o momento atual real) esse sim é correto continuar
  // pegando no fuso LOCAL do dispositivo — queremos saber "que dia é
  // hoje, na visão do usuário", não em UTC. Só zeramos a hora, pra
  // comparar dia contra dia sem a fração de horas do momento atual
  // atrapalhar o cálculo.
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffDays = Math.round(
    (dueDateOnly.getTime() - nowOnly.getTime()) / (1000 * 60 * 60 * 24),
  );

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

  const isNear = diffDays <= 7;
  return {
    label: `Vence em ${diffDays} dias`,
    colorText: '#D97706',
    colorBg: '#FFFBEB',
  };
}
