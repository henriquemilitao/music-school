export type Payment = {
  id: string;
  amount: string;
  paidAmount: string | null; // NOVO — valor efetivamente cobrado no PIX (com desconto se pontual), null até o primeiro PIX ser gerado
  dueDate: string;
  paidAt: string | null;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
  referenceMonth: string;
  pixCopyPaste: string | null;
  pixQrCode: string | null;
  pixExpiresAt: string | null;
  paymentBundleId: string | null;
  studentId: string;
  student: { name: string };
  isEligibleForPayment: boolean | null;
  blockingPaymentId: string | null;
};
