// lib/adminPayments.ts
//
// Chamadas à API de faturas (admin), cache do React Query e as ações
// "desfazer pagamento" / "cancelar" / "reativar" com os diálogos de
// confirmação, compartilhadas pela lista (aba Faturas) e pelo detalhe.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { alertAsync, confirmAsync } from './dialog';
import { formatMonthLabelFromKey } from './paymentFormat';
import {
  cancelConfirmMessage,
  reactivateMessage,
  undoConfirmMessage,
} from './paymentView';
import type {
  AdminPaymentDetail,
  StudentPayment,
  UpdatePaymentBody,
} from './paymentTypes';
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

// paidAt: dia do pagamento "AAAA-MM-DD" (sem ele vale agora)
export async function confirmPaymentManually(
  paymentId: string,
  paidAt?: string,
) {
  const response = await api.patch<StudentPayment>(
    `/payments/${paymentId}/confirm`,
    paidAt ? { paidAt } : {},
  );
  return response.data;
}

export async function updatePayment(
  paymentId: string,
  body: UpdatePaymentBody,
) {
  const response = await api.patch<AdminPaymentDetail>(
    `/payments/${paymentId}`,
    body,
  );
  return response.data;
}

export async function cancelPayment(paymentId: string) {
  const response = await api.patch<AdminPaymentDetail>(
    `/payments/${paymentId}/cancel`,
    {},
  );
  return response.data;
}

export async function reactivatePayment(paymentId: string) {
  const response = await api.patch<AdminPaymentDetail>(
    `/payments/${paymentId}/reactivate`,
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

// Depois de confirmar/editar/cancelar...: atualiza o detalhe, a lista e o status do
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

// O mínimo que as ações precisam saber da fatura (a da lista já traz tudo)
export type PaymentRef = Pick<
  StudentPayment,
  | 'id'
  | 'studentId'
  | 'referenceMonth'
  | 'status'
  | 'amount'
  | 'paidAt'
  | 'dueDate'
  | 'paymentMethod'
>;

function errorMessage(error: unknown, fallback: string) {
  const message = (error as { friendlyMessage?: string } | null)
    ?.friendlyMessage;
  return message ?? fallback;
}

// Cada ação pergunta antes (sempre) e só então chama a API. Devolve true
// quando a mudança foi feita, pra tela decidir se fecha/atualiza algo.
// (Confirmar pagamento e editar têm tela própria: pedem a data/os campos.)
export function usePaymentActions() {
  const refresh = useRefreshPayments();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Roda a chamada com o "ocupado" ligado na fatura e já mostra o erro
  async function run(
    payment: PaymentRef,
    call: () => Promise<unknown>,
    failure: string,
  ) {
    setBusyId(payment.id);
    try {
      await call();
      refresh(payment.studentId, payment.id);
      return true;
    } catch (error) {
      await alertAsync({
        title: 'Erro',
        message: errorMessage(error, failure),
        tone: 'error',
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function undo(payment: PaymentRef) {
    const ok = await confirmAsync({
      title: 'Desfazer pagamento?',
      message: undoConfirmMessage(payment),
      confirmText: 'Desfazer pagamento',
      destructive: true,
    });
    return ok
      ? run(
          payment,
          () => undoPayment(payment.id),
          'Não foi possível desfazer o pagamento.',
        )
      : false;
  }

  async function cancel(payment: PaymentRef) {
    const paid = payment.status === 'PAID';
    const ok = await confirmAsync({
      title: paid
        ? 'Cancelar uma fatura paga?'
        : `Cancelar a fatura de ${formatMonthLabelFromKey(payment.referenceMonth)}?`,
      message: cancelConfirmMessage(payment),
      confirmText: paid ? 'Sim, cancelar fatura' : 'Cancelar fatura',
      cancelText: 'Voltar',
      destructive: true,
    });
    return ok
      ? run(
          payment,
          () => cancelPayment(payment.id),
          'Não foi possível cancelar a fatura.',
        )
      : false;
  }

  async function reactivate(payment: PaymentRef) {
    const ok = await confirmAsync({
      title: 'Reativar fatura?',
      message: reactivateMessage(payment),
      confirmText: 'Reativar fatura',
    });
    return ok
      ? run(
          payment,
          () => reactivatePayment(payment.id),
          'Não foi possível reativar a fatura.',
        )
      : false;
  }

  return { undo, cancel, reactivate, busyId };
}

export type PaymentActions = ReturnType<typeof usePaymentActions>;
