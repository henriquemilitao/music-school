import { View, Text } from 'react-native';

export function Badge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <Text className="text-[11px] font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
