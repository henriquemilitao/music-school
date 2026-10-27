import { View, Text } from 'react-native';

// Rótulo + valor, com ícone opcional. `full` ocupa a linha inteira do cartão
// (nome, e-mail, data de nascimento — valores longos).
export function InfoBloco({
  label,
  valor,
  icon: Icon,
  full,
}: {
  label: string;
  valor: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  full?: boolean;
}) {
  return (
    <View className={full ? 'w-full mb-3' : 'w-1/2 mb-3 pr-2'}>
      <View className="flex-row items-center gap-1.5">
        {Icon && <Icon size={12} color="#B08D57" />}
        <Text className="text-xs text-gray-400">{label}</Text>
      </View>
      <Text
        className="text-sm font-medium mt-0.5"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {valor}
      </Text>
    </View>
  );
}
