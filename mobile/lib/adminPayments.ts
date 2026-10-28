// lib/adminPayments.ts
//
// Chamadas à API de faturas (admin), cache do React Query e as ações
// "confirmar" / "desfazer" com os diálogos de confirmação, compartilhadas
// pela lista (aba Faturas) e pelo detalhe da fatura.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { alertAsync, confirmAsync } from './dialog';
import { formatMonthLabelFromKey } from './paymentFormat';
import { undoConfirmMessage } from './paymentView';
import type { AdminPaymentDetail, StudentPayment } from './paymentTypes';
import { adminPaymentKeys, dashboardKeys } from './queryKeys';

// ─── Chamadas ─────────────────────────────────────────────────────────

export async function fetchStudentPayments(studentId: string) {
  const response = await api.get<StudentPayment[]>(
    `/payments/student/${studentId}`,
  );
  return response.data;
}

export async function fetchAdminPayment(paymentId: string) {
  const response = await api.get<AdminPaymentDetail>(`/payments/${paymentId}`);
  return response.data;
}

export async function confirmPaymentManually(paymentId: string) {
  const response = await api.patch<StudentPayment>(
    `/payments/${paymentId}/confirm`,
    {},
  );
  return response.data;
}

export async function undoPayment(paymentId: string) {
  const response = await api.patch<StudentPayment>(
    `/payments/${paymentId}/unconfirm`,
    {},
  );
  return response.data;
}

// ─── Cache ────────────────────────────────────────────────────────────

export function useStudentPayments(studentId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminPaymentKeys.byStudent(studentId),
    queryFn: () => fetchStudentPayments(studentId),
    enabled: !!studentId && enabled,
    // Mostrar a aba na hora ao voltar a ela; confirmar/desfazer invalida
    staleTime: 30_000,
  });
}

export function useAdminPayment(paymentId: string) {
  return useQuery({
    queryKey: adminPaymentKeys.detail(paymentId),
    queryFn: () => fetchAdminPayment(paymentId),
    enabled: !!paymentId,
  });
}

// Depois de confirmar/desfazer: atualiza o detalhe, a lista e o status do
// aluno, a lista de pendências e o painel inicial.
export function useRefreshPayments() {
  const queryClient = useQueryClient();

  return (studentId: string, paymentId: string) => {
    const keys: (readonly unknown[])[] = [
      adminPaymentKeys.detail(paymentId),
      adminPaymentKeys.byStudent(studentId),
      adminPaymentKeys.studentStatus(studentId),
      adminPaymentKeys.pending(),
      dashboardKeys.all,
    ];
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };
}

// ─── Ações ────────────────────────────────────────────────────────────

type PaymentRef = Pick<StudentPayment, 'id' | 'studentId' | 'referenceMonth'>;

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { friendlyMessage?: string } | null)
    ?.friendlyMessage;
  return message ?? fallback;
}

// Cada ação pergunta antes (sempre) e só então chama a API. Devolve true
// quando a mudança foi feita, pra tela decidir se fecha/atualiza algo.
export function usePaymentActions() {
  const refresh = useRefreshPayments();
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: (payment: PaymentRef) => confirmPaymentManually(payment.id),
    onSuccess: (_data, payment) => refresh(payment.studentId, payment.id),
    onError: (error) =>
      void alertAsync({
        title: 'Erro',
        message: errorMessage(error, 'Não foi possível confirmar o pagamento.'),
        tone: 'error',
      }),
  });

  const undoMutation = useMutation({
    mutationFn: (payment: PaymentRef) => undoPayment(payment.id),
    onSuccess: (_data, payment) => refresh(payment.studentId, payment.id),
    onError: (error) =>
      void alertAsync({
        title: 'Erro',
        message: errorMessage(error, 'Não foi possível desfazer o pagamento.'),
        tone: 'error',
      }),
  });

  async function run(
    payment: PaymentRef,
    mutate: (payment: PaymentRef) => Promise<unknown>,
  ) {
    setBusyId(payment.id);
    try {
      await mutate(payment);
      return true;
    } catch {
      return false; // o Alert já foi mostrado no onError
    } finally {
      setBusyId(null);
    }
  }

  async function confirm(payment: PaymentRef) {
    const ok = await confirmAsync({
      title: 'Confirmar pagamento?',
      message: `Confirma que a fatura de ${formatMonthLabelFromKey(payment.referenceMonth)} foi paga? Ela será marcada como paga manualmente.`,
      confirmText: 'Confirmar pagamento',
    });
    return ok ? run(payment, confirmMutation.mutateAsync) : false;
  }

  async function undo(
    payment: PaymentRef &
      Pick<AdminPaymentDetail, 'status' | 'paymentMethod' | 'dueDate'>,
  ) {
    const ok = await confirmAsync({
      title: 'Desfazer pagamento?',
      message: undoConfirmMessage(payment),
      confirmText: 'Desfazer pagamento',
      destructive: true,
    });
    return ok ? run(payment, undoMutation.mutateAsync) : false;
  }

  return { confirm, undo, busyId };
}
