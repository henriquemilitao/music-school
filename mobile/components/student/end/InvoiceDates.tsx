import { Text, View } from 'react-native';
import { CalendarDays, CalendarClock } from 'lucide-react-native';
import { invoiceDueLabel, invoicePeriodLabel } from './invoiceLabels';

type Props = Parameters<typeof invoicePeriodLabel>[0];

// Período de aulas que a fatura cobre + data de vencimento
export function InvoiceDates({ invoice }: { invoice: Props }) {
  const period = invoicePeriodLabel(invoice);
  return (
    <View className="gap-1">
      {period ? (
        <View className="flex-row items-center gap-1.5">
          <CalendarDays size={13} color="#6B7280" />
          <Text className="text-xs text-gray-500">{period}</Text>
        </View>
      ) : null}
      <View className="flex-row items-center gap-1.5">
        <CalendarClock size={13} color="#6B7280" />
        <Text className="text-xs text-gray-500">
          {invoiceDueLabel(invoice)}
        </Text>
      </View>
    </View>
  );
}
