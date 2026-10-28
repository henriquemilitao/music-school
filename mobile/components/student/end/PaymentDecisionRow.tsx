import { Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle2, Info } from 'lucide-react-native';
import { formatMonthLabelFromKey } from '../../../lib/paymentFormat';
import { paymentStatusConfig } from '../../../lib/status';
import type {
  EndPaymentOption,
  PaymentDecision,
} from '../../../lib/studentAdmin';
import { Badge } from '../detail/Badge';
import { InvoiceDates } from './InvoiceDates';
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
  tone = 'default',
  onPress,
}: {
  label: string;
  selected: boolean;
  tone?: 'default' | 'danger' | 'success';
  onPress: () => void;
}) {
  const activeBg =
    tone === 'danger' ? '#DC2626' : tone === 'success' ? '#059669' : '#B08D57';
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

// Uma fatura + a escolha do admin. Em aberto: manter, já foi paga ou apagar.
// Paga: manter ou estornar e apagar. Sem nenhuma escolha mexida, a fatura
// continua como está (por isso "Manter" é o padrão).
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
  const markingPaid = decision === 'MARK_PAID';

  return (
    <View
      className="rounded-xl p-3.5 gap-3"
      style={{
        backgroundColor: '#F5F1EA',
        borderWidth: 1,
        borderColor: deleting
          ? '#FCA5A5'
          : markingPaid
            ? '#6EE7B7'
            : 'transparent',
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2 gap-1.5">
          <View>
            <Text className="text-sm font-semibold">
              {formatMonthLabelFromKey(payment.referenceMonth)}
            </Text>
            <Text className="text-[13px] text-gray-500 mt-0.5">
              {formatCurrencyBRL(payment.amount)}
            </Text>
          </View>
          <InvoiceDates invoice={payment} />
        </View>
        {markingPaid ? (
          <Badge label="Paga" bg="#ECFDF5" color="#059669" />
        ) : (
          <Badge label={cfg.label} bg={cfg.colorBg} color={cfg.colorText} />
        )}
      </View>

      {hint ? <Text className="text-xs text-gray-500">{hint}</Text> : null}

      {isPaid && !payment.deletable ? null : (
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          <Choice
            label={isPaid ? 'Manter paga' : 'Manter'}
            selected={decision === 'KEEP'}
            onPress={() => onChange('KEEP')}
          />
          {!isPaid ? (
            <Choice
              label="Já foi paga"
              selected={markingPaid}
              tone="success"
              onPress={() => onChange('MARK_PAID')}
            />
          ) : null}
          {payment.deletable ? (
            <Choice
              label={isPaid ? 'Estornar e apagar' : 'Apagar'}
              selected={deleting}
              tone="danger"
              onPress={() => onChange('DELETE')}
            />
          ) : null}
        </View>
      )}

      {markingPaid ? (
        <View
          className="flex-row gap-2 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#ECFDF5' }}
        >
          <CheckCircle2 size={15} color="#059669" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-[#065F46] leading-4">
            A fatura será confirmada como paga (confirmação manual) ao encerrar.
          </Text>
        </View>
      ) : null}

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
