import { View, Text } from 'react-native';

type StatusPillProps = {
  label: string;
  colorText: string;
  colorBg: string;
  size?: 'sm' | 'md';
};

export function StatusPill({
  label,
  colorText,
  colorBg,
  size = 'sm',
}: StatusPillProps) {
  const isSmall = size === 'sm';

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexShrink: 0,
        flexGrow: 0,
        backgroundColor: colorBg,
        borderRadius: 999,
        paddingHorizontal: isSmall ? 10 : 12,
        paddingVertical: isSmall ? 4 : 6,
      }}
    >
      <Text
        style={{
          color: colorText,
          fontSize: isSmall ? 11 : 12,
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
