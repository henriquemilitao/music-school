import { Text, TouchableOpacity, View } from 'react-native';

type SegmentedControlProps<T extends string> = {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
};

// Seletor de abas em formato de pílula (ex: Visão geral / Aulas / Faturas).
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View
      className="flex-row bg-white rounded-full p-1"
      style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => onChange(option.key)}
            className={`flex-1 rounded-full py-2 items-center ${
              selected ? 'bg-[#B08D57]' : ''
            }`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              className={`text-sm font-medium ${
                selected ? 'text-white' : 'text-gray-500'
              }`}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
