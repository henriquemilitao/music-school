import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  // primary = dourado cheio · secondary = contorno · danger = vermelho cheio
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  // Ícone opcional à esquerda do texto
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  // Ocupa o espaço disponível numa linha de botões (padrão: sim)
  grow?: boolean;
};

const STYLES = {
  primary: { bg: '#B08D57', border: '#B08D57', text: '#FFFFFF' },
  secondary: { bg: '#FFFFFF', border: 'rgba(0,0,0,0.12)', text: '#1A1A1A' },
  danger: { bg: '#DC2626', border: '#DC2626', text: '#FFFFFF' },
} as const;

// Botão padrão das telas de formulário/ação (altura 48, cantos 12).
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon: Icon,
  grow = true,
}: ButtonProps) {
  const style = STYLES[variant];
  const inactive = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      activeOpacity={0.85}
      className={`${grow ? 'flex-1' : ''} h-12 flex-row items-center justify-center gap-2 rounded-xl px-5`}
      style={{
        backgroundColor: style.bg,
        borderWidth: 1,
        borderColor: style.border,
        opacity: inactive ? 0.45 : 1,
      }}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={style.text} />
      ) : (
        <View className="flex-row items-center gap-2">
          {Icon ? <Icon size={16} color={style.text} /> : null}
          <Text
            className="font-semibold text-[15px]"
            style={{ color: style.text }}
          >
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
