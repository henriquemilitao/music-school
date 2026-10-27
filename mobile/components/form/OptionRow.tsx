import { View, Text, TouchableOpacity } from 'react-native';
import { CalendarDays, Check } from 'lucide-react-native';

type OptionRowProps = {
  selected: boolean;
  title: string;
  subtitle?: string;
  onPress: () => void;
  // Mostra um ícone de calendário à direita (opção que abre o calendário)
  trailingIcon?: boolean;
};

// Opção de escolha única em linha inteira. Selecionada = dourado cheio, pra
// ficar claro o que vai ser salvo.
export function OptionRow({
  selected,
  title,
  subtitle,
  onPress,
  trailingIcon,
}: OptionRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center gap-3 rounded-xl px-4 py-3"
      style={{
        backgroundColor: selected ? '#B08D57' : '#fff',
        borderWidth: 1,
        borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.1)',
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View
        className="w-5 h-5 rounded-full items-center justify-center"
        style={{
          backgroundColor: selected ? '#fff' : 'transparent',
          borderWidth: selected ? 0 : 2,
          borderColor: '#D4CFC4',
        }}
      >
        {selected && <Check size={12} color="#B08D57" strokeWidth={3} />}
      </View>
      <View className="flex-1">
        <Text
          className="text-sm font-semibold"
          style={{ color: selected ? '#fff' : '#1A1A1A' }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="text-xs mt-0.5"
            style={{ color: selected ? 'rgba(255,255,255,0.9)' : '#6B7280' }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailingIcon && (
        <CalendarDays size={18} color={selected ? '#fff' : '#B08D57'} />
      )}
    </TouchableOpacity>
  );
}
