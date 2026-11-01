import { View, Text, TouchableOpacity } from 'react-native';
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Ellipsis,
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
import { StatusPill } from '../ui/StatusPill';

type Props = {
  payment: StudentPayment;
  onOpen: () => void;
  // Atalho "Confirmar pagamento" (só aparece nas faturas em aberto)
  onConfirm: () => void;
  // Menu "⋯" com as demais ações (editar, cancelar...)
  onMore: () => void;
  busy?: boolean;
};

// Fatura do aluno na aba "Faturas": mês, período das aulas, valor,
// vencimento e situação. O card inteiro abre o detalhe; nas em aberto há
// também o botão de confirmar pagamento, e o "⋯" abre as outras ações.
export function PaymentCard({
  payment,
  onOpen,
  onConfirm,
  onMore,
  busy,
}: Props) {
  const status = paymentStatusConfig(payment.status);
  const paid = payment.status === 'PAID';
  const cancelled = payment.status === 'CANCELLED';
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
      <View
        className="bg-white rounded-2xl p-5 gap-3"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
          opacity: cancelled ? 0.75 : 1,
          // atrasada chama a atenção sem gritar: filete vermelho à esquerda
          borderLeftWidth: overdue ? 3 : 0,
          borderLeftColor: '#DC2626',
        }}
      >
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-[#F3EADD] items-center justify-center">
            {paid ? (
              <CheckCircle2 size={18} color="#16A34A" />
            ) : cancelled ? (
              <Ban size={18} color="#9CA3AF" />
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
            <Text
              className="text-lg font-bold mt-0.5"
              style={{
                textDecorationLine: cancelled ? 'line-through' : 'none',
                color: cancelled ? '#9CA3AF' : '#1A1A1A',
              }}
            >
              {formatCurrencyBRL(getDisplayAmount(payment))}
            </Text>
          </View>
          <View className="items-end">
            {paid && payment.paidAt ? (
              <Text className="text-xs text-gray-500">
                Paga em {formatInstantDate(payment.paidAt)}
              </Text>
            ) : cancelled ? (
              <Text className="text-xs text-gray-500">
                {payment.cancelledAt
                  ? `Cancelada em ${formatInstantDate(payment.cancelledAt)}`
                  : 'Cancelada'}
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
          {paid || cancelled ? (
            <View />
          ) : (
            <TouchableOpacity
              onPress={onConfirm}
              disabled={busy}
              activeOpacity={0.85}
              className="flex-row items-center gap-1.5 bg-[#B08D57] rounded-full px-4 py-2.5"
              style={{ opacity: busy ? 0.5 : 1 }}
              accessibilityRole="button"
              accessibilityLabel="Confirmar pagamento"
              accessibilityState={{ disabled: !!busy, busy: !!busy }}
            >
              <Check size={13} color="#fff" />
              <Text className="text-white text-[13px] font-semibold">
                Confirmar pagamento
              </Text>
            </TouchableOpacity>
          )}
          <View className="flex-row items-center gap-1">
            <TouchableOpacity
              onPress={onMore}
              disabled={busy}
              hitSlop={8}
              activeOpacity={0.7}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{ backgroundColor: '#F5F1EA', opacity: busy ? 0.5 : 1 }}
              accessibilityRole="button"
              accessibilityLabel={`Mais ações da fatura de ${monthLabel}`}
            >
              <Ellipsis size={18} color="#1A1A1A" />
            </TouchableOpacity>
            <View className="flex-row items-center gap-0.5 pl-1">
              <Text className="text-xs font-semibold text-[#B08D57]">
                Ver detalhes
              </Text>
              <ChevronRight size={16} color="#B08D57" />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
