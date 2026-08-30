// lib/paymentFormat.ts
//
// Fonte única de formatação/exibição de dados de pagamento — evita
// que datas, valores e status sejam formatados de jeitos ligeiramente
// diferentes em cada tela (dashboard, lista, detalhe, checkout, bundle).

import { paymentStatusConfig } from './status';

// mantém o nome antigo por compatibilidade com quem já importa
// statusConfig de paymentFormat — assim você não precisa trocar
// todos os imports de uma vez
export const statusConfig = paymentStatusConfig;

export type PaymentStatus = 'PENDING' | 'OVERDUE' | 'PAID';

// referenceMonth vem como "2026-08" (sem dia) — precisa completar
// antes de criar o Date, senão dá Invalid Date.
export function formatMonthLabelFromKey(monthKey: string) {
  return formatMonthLabel(monthKey + '-01');
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// mm:ss — countdown de PIX nunca passa de minutos, não precisa
// mostrar dias/horas
export function formatPixCountdown(minutes: number, seconds: number) {
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(iso: string) {
  // timeZone: 'UTC' é essencial aqui — dueDate/paidAt vêm do backend
  // como meia-noite UTC representando um DIA CIVIL, não um instante
  // específico. Sem forçar UTC, o toLocaleDateString usa o fuso
  // horário do dispositivo pra formatar, o que pode "voltar" a data
  // em 1 dia pra qualquer usuário em fuso negativo (ex: Brasília,
  // UTC-3) — é exatamente o bug que fazia dia 07 aparecer como dia 06.
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatFullDate(iso: string) {
  const date = new Date(iso);
  const label = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC', // mesmo motivo do formatDate acima
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthLabel(referenceMonth: string) {
  const monthKey = referenceMonth.slice(0, 7);
  const date = new Date(monthKey + '-01T00:00:00');
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC', // idem — referenceMonth também é uma data "pura"
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthNameOnly(referenceMonth: string) {
  const monthKey = referenceMonth.slice(0, 7);
  const date = new Date(monthKey + '-01T00:00:00');
  const label = date.toLocaleDateString('pt-BR', {
    month: 'long',
    timeZone: 'UTC', // idem
  });
  return label;
}
