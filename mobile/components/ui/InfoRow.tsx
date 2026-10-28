import { ComponentType } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

type InfoRowProps = {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
  // Se passar, a linha vira um link (com seta à direita).
  onPress?: () => void;
  // Texto de ação ao lado da seta (ex: "Ver perfil"), deixa claro que é clicável.
  actionLabel?: string;
};

// Linha "ícone + rótulo + valor" dos cards de detalhe (horário,
// professor, instrumento...).
export function InfoRow({
  icon: Icon,
  label,
  value,
  onPress,
  actionLabel,
}: InfoRowProps) {
  const content = (
    <>
      <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
        <Icon size={17} color="#B08D57" />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-400">{label}</Text>
        <Text className="text-sm font-medium">{value}</Text>
      </View>
      {onPress && (
        <View className="flex-row items-center gap-0.5">
          {actionLabel ? (
            <Text className="text-xs font-semibold text-[#B08D57]">
              {actionLabel}
            </Text>
          ) : null}
          <ChevronRight size={16} color={actionLabel ? '#B08D57' : '#D4CFC4'} />
        </View>
      )}
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
