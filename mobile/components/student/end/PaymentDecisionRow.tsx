import { Text, TouchableOpacity, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { formatMonthLabelFromKey } from '../../../lib/paymentFormat';
import { paymentStatusConfig } from '../../../lib/status';
import type {
  EndPaymentOption,
  PaymentDecision,
} from '../../../lib/studentAdmin';
import { Badge } from '../detail/Badge';
import { formatCurrencyBRL } from '../detail/format';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

// Frase curta explicando o que acontece com as aulas do mês da fatura
function lessonsHint(payment: EndPaymentOption) {
  if (payment.lessonsCancelled === 0) return null;
  if (payment.lessonsRemaining === 0) {
    return 'Todas as aulas deste ciclo serão canceladas.';
  }
  return `${plural(payment.lessonsRemaining, 'aula continua', 'aulas continuam')} neste ciclo e ${plural(payment.lessonsCancelled, 'será cancelada', 'serão canceladas')}.`;
}

function Choice({
  label,
  selected,
  danger,
  onPress,
}: {
  label: string;
  selected: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const activeBg = danger ? '#DC2626' : '#B08D57';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-1 h-10 items-center justify-center rounded-lg"
      style={{
        backgroundColor: selected ? activeBg : '#FFFFFF',
        borderWidth: 1,
        borderColor: selected ? activeBg : 'rgba(0,0,0,0.12)',
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text
        className="text-[13px] font-semibold"
        style={{ color: selected ? '#FFFFFF' : '#1A1A1A' }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Uma fatura + a escolha do admin: manter ou apagar (estornar, se já paga).
export function PaymentDecisionRow({
  payment,
  decision,
  onChange,
}: {
  payment: EndPaymentOption;
  decision: PaymentDecision;
  onChange: (decision: PaymentDecision) => void;
}) {
  const cfg = paymentStatusConfig(payment.status);
  const isPaid = payment.status === 'PAID';
  const hint = lessonsHint(payment);
  const deleting = decision === 'DELETE';

  return (
    <View
      className="rounded-xl p-3.5 gap-3"
      style={{
        backgroundColor: '#F5F1EA',
        borderWidth: 1,
        borderColor: deleting ? '#FCA5A5' : 'transparent',
      }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-2">
          <Text className="text-sm font-semibold">
            {formatMonthLabelFromKey(payment.referenceMonth)}
          </Text>
          <Text className="text-[13px] text-gray-500 mt-0.5">
            {formatCurrencyBRL(payment.amount)}
          </Text>
        </View>
        <Badge label={cfg.label} bg={cfg.colorBg} color={cfg.colorText} />
      </View>

      {hint ? (
        <Text className="text-xs text-gray-500 -mt-1">{hint}</Text>
      ) : null}

      <View className="flex-row gap-2" accessibilityRole="radiogroup">
        <Choice
          label={isPaid ? 'Manter paga' : 'Manter'}
          selected={!deleting}
          onPress={() => onChange('KEEP')}
        />
        <Choice
          label={isPaid ? 'Estornar e apagar' : 'Apagar'}
          selected={deleting}
          danger
          onPress={() => onChange('DELETE')}
        />
      </View>

      {isPaid && deleting ? (
        <View
          className="flex-row gap-2 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#FFFBEB' }}
        >
          <Info size={15} color="#D97706" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-[#92400E] leading-4">
            A fatura sai do sistema, mas o sistema não devolve o dinheiro: faça
            o estorno ao responsável por fora.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
