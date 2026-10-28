import { formatDate } from '../../../lib/paymentFormat';

type InvoiceDates = {
  dueDate: string;
  periodStart: string | null;
  periodLastDay: string | null;
};

// "Aulas de 01/10/2026 a 31/10/2026" (null para fatura avulsa, sem período)
export function invoicePeriodLabel(invoice: InvoiceDates) {
  if (!invoice.periodStart || !invoice.periodLastDay) return null;
  return `Aulas de ${formatDate(invoice.periodStart)} a ${formatDate(invoice.periodLastDay)}`;
}

export function invoiceDueLabel(invoice: InvoiceDates) {
  return `Vence ${formatDate(invoice.dueDate)}`;
}
