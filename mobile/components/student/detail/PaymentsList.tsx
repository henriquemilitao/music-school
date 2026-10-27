import { View, Text, TouchableOpacity } from 'react-native';
import { Check, CreditCard } from 'lucide-react-native';
import { confirmAsync } from '../../../lib/confirm';
import { formatDate } from '../../../lib/paymentFormat';
import { Badge } from './Badge';
import { formatCurrencyBRL } from './format';

export type StudentPayment = {
  id: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  referenceMonth: string;
};

function statusConfig(status: StudentPayment['status']) {
  if (status === 'PAID')
    return { label: 'Paga', bg: '#ECFDF5', text: '#059669' };
  if (status === 'OVERDUE')
    return { label: 'Atrasada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Pendente', bg: '#FFFBEB', text: '#D97706' };
}

// Faturas do aluno, com o atalho "Confirmar pagamento" nas em aberto.
export function PaymentsList({
  payments,
  onConfirm,
}: {
  payments: StudentPayment[];
  onConfirm: (paymentId: string) => void;
}) {
  async function handleConfirm(paymentId: string) {
    const ok = await confirmAsync({
      title: 'Confirmar pagamento',
      message: 'Confirma que essa fatura foi paga manualmente?',
      confirmText: 'Confirmar',
    });
    if (ok) onConfirm(paymentId);
  }

  return (
    <View className="gap-2.5">
      {payments.map((payment, i) => {
        const cfg = statusConfig(payment.status);
        return (
          <View
            key={payment.id}
            className="py-2.5"
            style={
              i > 0
                ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }
                : undefined
            }
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
                  <CreditCard size={16} color="#B08D57" />
                </View>
                <View>
                  <Text className="text-sm font-medium">
                    {formatCurrencyBRL(payment.amount)}
                  </Text>
                  <Text className="text-[13px] text-gray-500 mt-0.5">
                    Venc. {formatDate(payment.dueDate)}
                  </Text>
                </View>
              </View>
              <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
            </View>
            {payment.status !== 'PAID' && (
              <TouchableOpacity
                onPress={() => void handleConfirm(payment.id)}
                className="flex-row items-center gap-1.5 self-start mt-2.5 bg-[#B08D57] rounded-full px-3.5 py-2"
              >
                <Check size={12} color="#fff" />
                <Text className="text-white text-xs font-medium">
                  Confirmar pagamento
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}
