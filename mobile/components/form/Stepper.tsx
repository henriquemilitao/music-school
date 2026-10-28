import { Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  // Texto mostrado no meio, a partir do valor ("+2 dias", "Sem mudança")
  format: (value: number) => string;
  decrementLabel: string;
  incrementLabel: string;
};

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      className="w-11 h-11 rounded-xl items-center justify-center bg-white"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.12)',
        opacity: disabled ? 0.35 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon size={18} color="#1A1A1A" />
    </TouchableOpacity>
  );
}

// Contador com − e + (ex: mover as aulas N dias).
export function Stepper({
  value,
  onChange,
  min,
  max,
  format,
  decrementLabel,
  incrementLabel,
}: StepperProps) {
  return (
    <View className="flex-row items-center gap-3">
      <StepButton
        icon={Minus}
        label={decrementLabel}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <View
        className="flex-1 h-11 rounded-xl items-center justify-center"
        style={{ backgroundColor: '#F5F1EA' }}
        accessibilityLiveRegion="polite"
      >
        <Text className="text-sm font-semibold">{format(value)}</Text>
      </View>
      <StepButton
        icon={Plus}
        label={incrementLabel}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}
