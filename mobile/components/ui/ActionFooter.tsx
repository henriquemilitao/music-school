import { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOverlap } from '../../lib/useKeyboardOverlap';

// Barra de ações fixa no rodapé (salvar / continuar). Respeita a área segura
// quando o teclado está fechado; com o teclado aberto, o DetailScreen já
// empurra o rodapé pra cima.
export function ActionFooter({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboardOverlap = useKeyboardOverlap();

  return (
    <View
      className="px-5 pt-3 bg-[#F5F1EA] flex-row gap-3"
      style={{
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
        paddingBottom: keyboardOverlap > 0 ? 12 : insets.bottom + 12,
      }}
    >
      {children}
    </View>
  );
}
