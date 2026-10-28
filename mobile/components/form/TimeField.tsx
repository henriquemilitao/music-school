import { maskTime } from '../../lib/newStudent';
import { TextField } from './FormField';

type TimeFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  // HH:mm ('' = vazio)
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// Campo de horário HH:mm com máscara (digita 1530 → 15:30).
export function TimeField({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  placeholder = '15:00',
}: TimeFieldProps) {
  return (
    <TextField
      label={label}
      required={required}
      error={error}
      hint={hint}
      value={value}
      onChangeText={(text) => onChange(maskTime(text))}
      placeholder={placeholder}
      keyboardType="number-pad"
      maxLength={5}
    />
  );
}
