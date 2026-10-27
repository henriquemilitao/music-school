import { Text, TouchableOpacity } from 'react-native';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // primary = dourado cheio; secondary = contorno
  variant?: 'primary' | 'secondary';
};

export function AuthButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
}: AuthButtonProps) {
  const isPrimary = variant === 'primary';
  const inactive = loading || disabled;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      className={`rounded-xl py-4 items-center ${
        isPrimary ? 'bg-[#B08D57]' : 'bg-white'
      }`}
      style={{
        opacity: inactive ? 0.6 : 1,
        borderWidth: isPrimary ? 0 : 1,
        borderColor: 'rgba(176,141,87,0.5)',
      }}
      accessibilityRole="button"
    >
      <Text
        className={`font-bold text-base ${
          isPrimary ? 'text-white' : 'text-[#B08D57]'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
