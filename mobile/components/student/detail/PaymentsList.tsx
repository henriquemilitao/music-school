import { View, Text } from 'react-native';
import type { StudentPayment } from '../../../lib/paymentTypes';
import { splitPayments } from '../../../lib/paymentView';
import { PaymentCard } from '../../payment/PaymentCard';

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57] mt-1">
      {children}
    </Text>
  );
}

// Aba "Faturas" do aluno: as em aberto no topo (a mais antiga primeiro) e
// o histórico de pagas logo abaixo.
export function PaymentsList({
  payments,
  onOpen,
  onConfirm,
  busyId,
}: {
  payments: StudentPayment[];
  onOpen: (paymentId: string) => void;
  onConfirm: (payment: StudentPayment) => void;
  busyId: string | null;
}) {
  const { open, settled } = splitPayments(payments);

  const renderCard = (payment: StudentPayment) => (
    <PaymentCard
      key={payment.id}
      payment={payment}
      onOpen={() => onOpen(payment.id)}
      onConfirm={() => onConfirm(payment)}
      confirming={busyId === payment.id}
    />
  );

  return (
    <View className="gap-3">
      {open.length > 0 && (
        <>
          <SectionLabel>{`Em aberto (${open.length})`}</SectionLabel>
          {open.map(renderCard)}
        </>
      )}
      {settled.length > 0 && (
        <>
          <SectionLabel>{`Pagas (${settled.length})`}</SectionLabel>
          {settled.map(renderCard)}
        </>
      )}
    </View>
  );
}
