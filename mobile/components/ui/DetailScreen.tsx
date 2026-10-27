import { ReactNode } from 'react';
import { ScrollView, View, RefreshControlProps } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from './ScreenHeader';

type DetailScreenProps = {
  title: string;
  onBack?: () => void;
  // Ação opcional no canto direito do header (ex: botão "Editar").
  headerRight?: ReactNode;
  // Conteúdo que rola. O header NUNCA rola junto.
  children: ReactNode;
  // Conteúdo fixo abaixo da área rolável (ex: barra de ações / botão salvar).
  footer?: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
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
}: DetailScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-[#F5F1EA]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title={title} onBack={onBack} right={headerRight} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: footer ? 0 : insets.bottom }}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
