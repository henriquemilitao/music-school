import { ReactNode, Ref, useState } from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { FIELD_HEIGHT, FIELD_PADDING_X } from './fieldMetrics';

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
  // Pra focar este campo a partir de outro (ao apertar "próximo" no teclado).
  inputRef?: Ref<TextInput>;
};

export function TextField({
  label,
  required,
  error,
  hint,
  prefix,
  multiline,
  inputRef,
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
        className="flex-row rounded-xl"
        style={{
          borderWidth: focused || error ? 1.5 : 1,
          borderColor,
          backgroundColor: '#F5F1EA',
          alignItems: multiline ? 'flex-start' : 'center',
          paddingHorizontal: FIELD_PADDING_X,
          height: multiline ? undefined : FIELD_HEIGHT,
          overflow: 'hidden',
        }}
      >
        {prefix ? (
          <Text className="text-[#1A1A1A] mr-1.5 font-medium">{prefix}</Text>
        ) : null}
        <TextInput
          {...inputProps}
          ref={inputRef}
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
          className="flex-1 text-[#1A1A1A]"
          style={
            multiline
              ? { minHeight: 88, paddingVertical: 12 }
              : {
                  paddingVertical: 0,
                  height: '100%',
                  includeFontPadding: false,
                }
          }
        />
      </View>
    </FormField>
  );
}
