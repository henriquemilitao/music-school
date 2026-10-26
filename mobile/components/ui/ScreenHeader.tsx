import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

type ScreenHeaderProps = {
  title: string;
  // Padrão: volta pra tela anterior (ou pro início, se a tela foi aberta
  // direto, sem histórico).
  onBack?: () => void;
  // Ação opcional no canto direito (ex: botão "Salvar").
  right?: ReactNode;
};

// Header das telas de detalhe: botão redondo de voltar + título, no mesmo
// visual que lesson/[id], student/[id] e payment/[id] já usavam.
export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  const router = useRouter();

  function handleBack() {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View
      className="flex-row items-center px-4 pt-14 pb-3 bg-[#F5F1EA]"
      style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }}
    >
      <TouchableOpacity
        className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3"
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
        onPress={handleBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
      >
        <ArrowLeft size={18} color="#1A1A1A" />
      </TouchableOpacity>
      <Text className="flex-1 text-base font-semibold" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
