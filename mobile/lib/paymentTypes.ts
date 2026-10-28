// lib/paymentTypes.ts
//
// Tipos das faturas na visão do admin (lista do aluno e detalhe).

import type { PaymentStatus } from './status';

export type { PaymentStatus };

// Item da aba "Faturas" do aluno (GET /payments/student/:id)
export type StudentPayment = {
  id: string;
  studentId: string;
  amount: string;
  // Valor realmente cobrado no PIX (pode ter desconto de pontualidade)
  paidAmount: string | null;
  dueDate: string;
  paidAt: string | null;
  status: PaymentStatus;
  referenceMonth: string;
  paymentMethod: 'MANUAL_PIX' | 'GATEWAY';
  paymentBundleId: string | null;
  // Período de aulas que a fatura cobre ("AAAA-MM-DD"); null em fatura
  // avulsa/antiga ou sem matrícula
  periodStart: string | null;
  periodLastDay: string | null;
};

// Detalhe (GET /payments/:id)
export type AdminPaymentDetail = StudentPayment & {
  proofUrl: string | null;
  webhookReceivedAt: string | null;
  confirmedByName: string | null;
  student: { id: string; name: string; instrument: string | null };
  paymentBundle: {
    id: string;
    status: 'PENDING' | 'PAID' | 'CANCELLED';
    amount: string;
  } | null;
};
