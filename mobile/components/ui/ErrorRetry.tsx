import { Text, View } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { Button } from './Button';

// Falha ao CARREGAR algo (rede, servidor). Mostra o motivo e um botão de
// tentar de novo — melhor do que fingir que a lista está vazia.
export function ErrorRetry({
  message = 'Não foi possível carregar. Verifique a conexão e tente de novo.',
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <View
      className="rounded-xl p-4 gap-3"
      style={{
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
      }}
    >
      <View className="flex-row items-start gap-2">
        <AlertCircle size={18} color="#DC2626" style={{ marginTop: 1 }} />
        <Text className="flex-1 text-sm text-[#B91C1C]">{message}</Text>
      </View>
      <Button
        label="Tentar de novo"
        variant="secondary"
        icon={RefreshCw}
        onPress={onRetry}
        loading={retrying}
      />
    </View>
  );
}
