import { View, Text, TouchableOpacity } from 'react-native';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
} from 'lucide-react-native';
import { formatCurrencyBRL } from '../student/detail/format';
import {
  formatDate,
  formatInstantDate,
  formatMonthLabelFromKey,
  getDisplayAmount,
} from '../../lib/paymentFormat';
import type { StudentPayment } from '../../lib/paymentTypes';
import { dueHint, formatPeriodRange } from '../../lib/paymentView';
import { paymentStatusConfig } from '../../lib/status';
import { Card } from '../ui/Card';
import { StatusPill } from '../ui/StatusPill';

type Props = {
  payment: StudentPayment;
  onOpen: () => void;
  // Atalho "Confirmar pagamento" (só aparece nas faturas em aberto)
  onConfirm: () => void;
  confirming?: boolean;
};

// Fatura do aluno na aba "Faturas": mês, período das aulas, valor,
// vencimento e situação. O card inteiro abre o detalhe; nas em aberto há
// também o botão de confirmar pagamento.
export function PaymentCard({ payment, onOpen, onConfirm, confirming }: Props) {
  const status = paymentStatusConfig(payment.status);
  const paid = payment.status === 'PAID';
  const overdue = payment.status === 'OVERDUE';
  const period = formatPeriodRange(payment.periodStart, payment.periodLastDay);
  const monthLabel = formatMonthLabelFromKey(payment.referenceMonth);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Fatura de ${monthLabel}, ${status.label}. Abrir detalhes`}
    >
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-[#F3EADD] items-center justify-center">
            {paid ? (
              <CheckCircle2 size={18} color="#16A34A" />
            ) : (
              <CreditCard size={18} color="#B08D57" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-bold">{monthLabel}</Text>
            <Text className="text-xs text-gray-500 mt-0.5">
              {period ? `Aulas de ${period}` : 'Fatura avulsa'}
            </Text>
          </View>
          <StatusPill {...status} />
        </View>

        <View
          className="flex-row items-end justify-between pt-3"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}
        >
          <View>
            <Text className="text-xs text-gray-400">
              {paid ? 'Valor pago' : 'Valor'}
            </Text>
            <Text className="text-lg font-bold mt-0.5">
              {formatCurrencyBRL(getDisplayAmount(payment))}
            </Text>
          </View>
          <View className="items-end">
            {paid && payment.paidAt ? (
              <Text className="text-xs text-gray-500">
                Paga em {formatInstantDate(payment.paidAt)}
              </Text>
            ) : (
              <Text
                className="text-xs font-semibold"
                style={{ color: overdue ? '#DC2626' : '#6B7280' }}
              >
                {dueHint(payment.dueDate)}
              </Text>
            )}
            <Text className="text-xs text-gray-400 mt-0.5">
              Vencimento {formatDate(payment.dueDate)}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          {paid ? (
            <View />
          ) : (
            <TouchableOpacity
              onPress={onConfirm}
              disabled={confirming}
              activeOpacity={0.85}
              className="flex-row items-center gap-1.5 bg-[#B08D57] rounded-full px-4 py-2.5"
              style={{ opacity: confirming ? 0.5 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Confirmar pagamento"
              accessibilityState={{
                disabled: !!confirming,
                busy: !!confirming,
              }}
            >
              <Check size={13} color="#fff" />
              <Text className="text-white text-[13px] font-semibold">
                Confirmar pagamento
              </Text>
            </TouchableOpacity>
          )}
          <View className="flex-row items-center gap-0.5">
            <Text className="text-xs font-semibold text-[#B08D57]">
              Ver detalhes
            </Text>
            <ChevronRight size={16} color="#B08D57" />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
