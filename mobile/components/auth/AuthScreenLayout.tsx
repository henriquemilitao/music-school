import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

type AuthScreenLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
};

// Casca das telas públicas (sem login): fundo creme, botão voltar,
// título/subtítulo e o conteúdo (normalmente um cartão branco).
export function AuthScreenLayout({
  title,
  subtitle,
  children,
  onBack,
}: AuthScreenLayoutProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F1EA]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableOpacity
        onPress={handleBack}
        className="absolute left-4 z-10 w-10 h-10 items-center justify-center"
        style={{ top: Math.max(insets.top + 8, 52) }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ChevronLeft size={26} color="#1A1A1A" />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-start',
          paddingTop: 120,
          paddingBottom: insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="px-6"
      >
        <View className="items-center mb-8">
          <Text
            className="text-3xl text-[#1A1A1A] text-center"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-sm text-gray-500 text-center mt-2 px-4">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
