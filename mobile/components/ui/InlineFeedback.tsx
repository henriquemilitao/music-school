// components/InlineFeedback.tsx
//
// Banner de feedback inline (sucesso/erro), pra usar no lugar de
// Alert.alert nas telas de auth. Fica dentro do fluxo da tela em vez
// de interromper com um popup do sistema.

import { View, Text } from 'react-native';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react-native';

export type FeedbackType = 'error' | 'success' | 'warning';

const STYLES: Record<
  FeedbackType,
  { bg: string; border: string; text: string; icon: string }
> = {
  error: { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', icon: '#DC2626' },
  success: {
    bg: '#F0FDF4',
    border: '#86EFAC',
    text: '#15803D',
    icon: '#16A34A',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FCD34D',
    text: '#B45309',
    icon: '#D97706',
  },
};

const ICONS = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
};

export function InlineFeedback({
  type,
  message,
}: {
  type: FeedbackType;
  message: string | null;
}) {
  if (!message) return null;

  const style = STYLES[type];
  const Icon = ICONS[type];

  return (
    <View
      className="rounded-xl px-4 py-3 mb-1 flex-row items-center gap-2"
      style={{
        backgroundColor: style.bg,
        borderWidth: 1,
        borderColor: style.border,
      }}
    >
      <Icon size={18} color={style.icon} />
      <Text
        className="text-sm font-medium flex-1"
        style={{ color: style.text }}
      >
        {message}
      </Text>
    </View>
  );
}
