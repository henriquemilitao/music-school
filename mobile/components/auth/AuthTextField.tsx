import { useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

type AuthTextFieldProps = TextInputProps & { label: string };

// Campo de texto das telas de autenticação: rótulo em caixa alta + borda
// dourada quando focado (mesmo visual do login).
export function AuthTextField({ label, ...inputProps }: AuthTextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
        {label}
      </Text>
      <TextInput
        {...inputProps}
        className="rounded-xl px-4 py-3 text-[#1A1A1A]"
        style={{
          borderWidth: focused ? 1.5 : 1,
          borderColor: focused ? '#B08D57' : 'rgba(0,0,0,0.08)',
          backgroundColor: '#F5F1EA',
        }}
        placeholderTextColor="#B0AA9C"
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
      />
    </View>
  );
}
