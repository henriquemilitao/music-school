import { ReactNode } from 'react';
import { ScrollView, View, RefreshControlProps } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOverlap } from '../../lib/useKeyboardOverlap';
import { ScreenHeader } from './ScreenHeader';

type DetailScreenProps = {
  title: string;
  onBack?: () => void;
  // Ação opcional no canto direito do header (ex: botão "Editar").
  headerRight?: ReactNode;
  // Conteúdo que rola. O header NUNCA rola junto.
  children: ReactNode;
  // Conteúdo fixo abaixo da área rolável — normalmente um <ActionFooter>.
  footer?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  // Padding extra do conteúdo rolável (ex: telas com cartões e 20px de borda).
  contentPadding?: boolean;
};

// Casca padrão das telas de detalhe: header fixo (voltar + título) no topo e
// só o conteúdo abaixo dele rola. Também esconde o header nativo do
// expo-router e respeita a área segura inferior (gestos do Android/iOS).
export function DetailScreen({
  title,
  onBack,
  headerRight,
  children,
  footer,
  refreshControl,
  keyboardShouldPersistTaps,
  contentPadding = false,
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();
  const keyboardOverlap = useKeyboardOverlap();

  return (
    // Com rodapé, o espaço do teclado entra aqui: o rodapé sobe junto com o
    // teclado e, com o teclado fechado, o padding é zero.
    <View
      className="flex-1 bg-[#F5F1EA]"
      style={{ paddingBottom: footer ? keyboardOverlap : 0 }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={title} onBack={onBack} right={headerRight} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: footer ? 24 : insets.bottom,
          ...(contentPadding
            ? { paddingHorizontal: 20, paddingTop: 20 }
            : null),
        }}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={footer ? 'on-drag' : undefined}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
