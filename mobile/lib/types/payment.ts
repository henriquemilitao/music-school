export type Payment = {
  id: string;
  amount: string;
  dueDate: string;
  paidAt: string | null;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
  referenceMonth: string;
  pixCopyPaste: string | null;
  pixQrCode: string | null;
  pixExpiresAt: string | null; // NOVO
  paymentBundleId: string | null;
  studentId: string;
  student: { name: string };
  isEligibleForPayment: boolean | null;
  blockingPaymentId: string | null;
};
