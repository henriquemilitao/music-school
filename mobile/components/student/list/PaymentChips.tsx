import { Text, TouchableOpacity, View } from 'react-native';
import type { PaymentCounts, PaymentFilter } from '../../../lib/studentList';

const CHIPS: { key: PaymentFilter; label: string; color: string }[] = [
  { key: 'ALL', label: 'Todos', color: '#1A1A1A' },
  { key: 'OK', label: 'Em dia', color: '#059669' },
  { key: 'PENDING', label: 'Pendentes', color: '#D97706' },
  { key: 'OVERDUE', label: 'Atrasados', color: '#DC2626' },
];

// Faixa única com a situação de pagamento: cada quadro mostra quantos
// alunos há e filtra ao toque (tocar de novo volta para "Todos").
export function PaymentChips({
  counts,
  value,
  onChange,
}: {
  counts: PaymentCounts;
  value: PaymentFilter;
  onChange: (value: PaymentFilter) => void;
}) {
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup">
      {CHIPS.map((chip) => {
        const selected = value === chip.key;
        return (
          <TouchableOpacity
            key={chip.key}
            onPress={() => onChange(selected ? 'ALL' : chip.key)}
            activeOpacity={0.8}
            className="flex-1 items-center rounded-xl bg-white py-2"
            style={{
              borderWidth: 1.5,
              borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.05)',
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${chip.label}: ${counts[chip.key]}`}
          >
            <Text
              className="text-lg leading-6"
              style={{
                fontFamily: 'PlayfairDisplay_700Bold',
                color: chip.color,
              }}
            >
              {counts[chip.key]}
            </Text>
            <Text className="text-[11px] text-gray-500" numberOfLines={1}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
