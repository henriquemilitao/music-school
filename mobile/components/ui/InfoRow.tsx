import { ComponentType } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

type InfoRowProps = {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  // Se passar, a linha vira um link (com seta à direita).
  onPress?: () => void;
};

// Linha "ícone + rótulo + valor" dos cards de detalhe (horário,
// professor, instrumento...).
export function InfoRow({ icon: Icon, label, value, onPress }: InfoRowProps) {
  const content = (
    <>
      <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
        <Icon size={17} color="#B08D57" />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-400">{label}</Text>
        <Text className="text-sm font-medium">{value}</Text>
      </View>
      {onPress && <ChevronRight size={16} color="#D4CFC4" />}
    </>
  );

  if (!onPress) {
    return <View className="flex-row items-center gap-3">{content}</View>;
  }

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      {content}
    </TouchableOpacity>
  );
}
