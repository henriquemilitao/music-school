import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';

// Aviso informativo discreto (azul-acinzentado), sem competir com os botões
export function InfoNotice({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="flex-row gap-2 rounded-lg px-3 py-2.5"
      style={{ backgroundColor: '#EFF6FF' }}
      accessibilityRole="summary"
    >
      <Info size={15} color="#2563EB" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs text-[#1E40AF] leading-4">
        {children}
      </Text>
    </View>
  );
}
