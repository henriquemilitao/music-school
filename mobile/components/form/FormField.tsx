import { ReactNode, useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { AlertCircle } from 'lucide-react-native';

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

// Rótulo + conteúdo + dica/erro. Campos obrigatórios levam "*" e o erro
// aparece logo abaixo do campo, em vermelho e com ícone (não depende só de
// cor).
export function FormField({
  label,
  required,
  error,
  hint,
  children,
}: FormFieldProps) {
  return (
    <View>
      <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
        {label}
        {required && <Text className="text-[#B08D57]"> *</Text>}
      </Text>
      {children}
      {error ? (
        <View
          className="flex-row items-center gap-1.5 mt-1.5 px-1"
          accessibilityRole="alert"
        >
          <AlertCircle size={13} color="#DC2626" />
          <Text className="text-xs text-red-600 flex-1">{error}</Text>
        </View>
      ) : hint ? (
        <Text className="text-xs text-gray-400 mt-1.5 px-1">{hint}</Text>
      ) : null}
    </View>
  );
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  // Texto fixo à esquerda do campo (ex: "R$").
  prefix?: string;
};

export function TextField({
  label,
  required,
  error,
  hint,
  prefix,
  multiline,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? '#FCA5A5'
    : focused
      ? '#B08D57'
      : 'rgba(0,0,0,0.08)';

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <View
        className="flex-row rounded-xl px-4"
        style={{
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: '#F5F1EA',
          alignItems: multiline ? 'flex-start' : 'center',
          minHeight: multiline ? undefined : 48,
        }}
      >
        {prefix ? (
          <Text className="text-[#1A1A1A] mr-1.5 py-3 font-medium">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          {...inputProps}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholderTextColor="#B0AA9C"
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          accessibilityLabel={label}
          className="flex-1 py-3 text-[#1A1A1A]"
          style={multiline ? { minHeight: 88 } : undefined}
        />
      </View>
    </FormField>
  );
}
