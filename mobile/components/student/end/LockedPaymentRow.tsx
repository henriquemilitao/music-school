import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { formatMonthLabelFromKey } from '../../../lib/paymentFormat';
import { paymentStatusConfig } from '../../../lib/status';
import type { EndPaymentOption } from '../../../lib/studentAdmin';
import { Badge } from '../detail/Badge';
import { formatCurrencyBRL } from '../detail/format';

// Fatura que será apagada sem escolha (vem depois da fatura em cujo fim a
// matrícula encerra). Se já estava paga, avisa do estorno.
export function LockedPaymentRow({ payment }: { payment: EndPaymentOption }) {
  const cfg = paymentStatusConfig(payment.status);

  return (
    <View
      className="rounded-xl p-3.5 gap-2.5"
      style={{
        backgroundColor: '#F5F1EA',
        borderWidth: 1,
        borderColor: '#FCA5A5',
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
        <View className="items-end gap-1.5">
          <Badge label={cfg.label} bg={cfg.colorBg} color={cfg.colorText} />
          <Text className="text-[11px] font-bold text-[#DC2626]">
            Será apagada
          </Text>
        </View>
      </View>

      {payment.status === 'PAID' ? (
        <View
          className="flex-row gap-2 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: '#FFFBEB' }}
        >
          <Info size={15} color="#D97706" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-[#92400E] leading-4">
            Esta fatura já foi paga. O sistema não devolve o dinheiro: faça o
            estorno ao responsável por fora.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
