import { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import type { PaymentActions } from '../../../lib/adminPayments';
import type { StudentPayment } from '../../../lib/paymentTypes';
import { groupPayments } from '../../../lib/paymentView';
import { ActionMenu } from '../../ui/ActionMenu';
import { PaymentCard } from '../../payment/PaymentCard';
import { buildPaymentMenuItems } from '../../payment/paymentMenu';

function SectionLabel({
  children,
  color = '#B08D57',
}: {
  children: string;
  color?: string;
}) {
  return (
    <Text
      className="text-xs font-bold uppercase tracking-widest mt-1"
      style={{ color }}
    >
      {children}
    </Text>
  );
}

type Props = {
  payments: StudentPayment[];
  actions: PaymentActions;
};

// Aba "Faturas" do aluno, em quatro grupos: Atrasadas (vermelho, no topo),
// Em aberto, Pagas e — recolhidas, pra não poluir — Canceladas. O "⋯" de cada
// fatura abre o menu de ações (editar, cancelar, desfazer, reativar).
export function PaymentsList({ payments, actions }: Props) {
  const router = useRouter();
  const { overdue, pending, paid, cancelled } = groupPayments(payments);
  const [menuPayment, setMenuPayment] = useState<StudentPayment | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);

  const openDetail = useCallback(
    (paymentId: string) => router.push(`/admin-payment/${paymentId}`),
    [router],
  );
  const openConfirm = useCallback(
    (paymentId: string) => router.push(`/payment-confirm/${paymentId}`),
    [router],
  );
  const openEdit = useCallback(
    (paymentId: string) => router.push(`/payment-edit/${paymentId}`),
    [router],
  );

  const renderCard = (payment: StudentPayment) => (
    <PaymentCard
      key={payment.id}
      payment={payment}
      onOpen={() => openDetail(payment.id)}
      onConfirm={() => openConfirm(payment.id)}
      onMore={() => setMenuPayment(payment)}
      busy={actions.busyId === payment.id}
    />
  );

  return (
    <>
      <View className="gap-3">
        {overdue.length > 0 && (
          <>
            <SectionLabel color="#DC2626">{`Atrasadas (${overdue.length})`}</SectionLabel>
            {overdue.map(renderCard)}
          </>
        )}
        {pending.length > 0 && (
          <>
            <SectionLabel>{`Em aberto (${pending.length})`}</SectionLabel>
            {pending.map(renderCard)}
          </>
        )}
        {paid.length > 0 && (
          <>
            <SectionLabel color="#16A34A">{`Pagas (${paid.length})`}</SectionLabel>
            {paid.map(renderCard)}
          </>
        )}
        {cancelled.length > 0 && (
          <>
            <TouchableOpacity
              onPress={() => setShowCancelled((value) => !value)}
              activeOpacity={0.7}
              className="flex-row items-center justify-between mt-1"
              accessibilityRole="button"
              accessibilityState={{ expanded: showCancelled }}
              accessibilityLabel={`Canceladas, ${cancelled.length}. ${showCancelled ? 'Recolher' : 'Mostrar'}`}
            >
              <SectionLabel color="#6B7280">{`Canceladas (${cancelled.length})`}</SectionLabel>
              {showCancelled ? (
                <ChevronUp size={16} color="#6B7280" />
              ) : (
                <ChevronDown size={16} color="#6B7280" />
              )}
            </TouchableOpacity>
            {showCancelled && cancelled.map(renderCard)}
          </>
        )}
      </View>

      <ActionMenu
        visible={!!menuPayment}
        onClose={() => setMenuPayment(null)}
        title={menuPayment ? 'Fatura' : undefined}
        items={
          menuPayment
            ? buildPaymentMenuItems({
                payment: menuPayment,
                actions,
                onConfirm: () => openConfirm(menuPayment.id),
                onEdit: () => openEdit(menuPayment.id),
              })
            : []
        }
      />
    </>
  );
}
