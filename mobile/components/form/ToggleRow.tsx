import { Switch, Text, View } from 'react-native';

type ToggleRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

// Linha "texto + interruptor" para opções liga/desliga de formulário.
export function ToggleRow({
  label,
  description,
  value,
  onChange,
}: ToggleRowProps) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <Text className="text-sm font-semibold">{label}</Text>
        {description ? (
          <Text className="text-xs text-gray-500 mt-0.5">{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#E5E0D5', true: '#B08D57' }}
        thumbColor="#FFFFFF"
        accessibilityLabel={label}
      />
    </View>
  );
}
