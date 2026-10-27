import { View, Text, TouchableOpacity } from 'react-native';

type Option<T> = { value: T; label: string };

type ChoiceChipsProps<T> = {
  options: Option<T>[];
  value: T | null | undefined;
  onChange: (value: T) => void;
};

// Escolha única em "pílulas" que quebram de linha — melhor que um select
// nativo quando são poucas opções (instrumentos, duração, professor).
export function ChoiceChips<T extends string | number | null>({
  options,
  value,
  onChange,
}: ChoiceChipsProps<T>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            className="rounded-full px-4 py-2.5"
            style={{
              backgroundColor: selected ? '#B08D57' : '#F5F1EA',
              borderWidth: 1,
              borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.08)',
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: selected ? '#fff' : '#4B5563' }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
