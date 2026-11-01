import { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';

// Aviso discreto dentro de um cartão/formulário (tom dourado, não é erro):
// explica uma consequência antes de a pessoa salvar.
export function Note({ children }: { children: ReactNode }) {
  return (
    <View
      className="flex-row gap-2 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: '#F3EADD' }}
    >
      <Info size={15} color="#B08D57" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs text-[#6B5B3E] leading-4">
        {children}
      </Text>
    </View>
  );
}
