import { useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Check, Mail } from 'lucide-react-native';
import { Card } from '../../ui/Card';
import { TextField } from '../../form/FormField';
import { maskPhone, type HolderType } from '../../../lib/newStudent';
import type { StepProps } from './types';

const HOLDER_OPTIONS: { value: HolderType; title: string; text: string }[] = [
  {
    value: 'SELF',
    title: 'O próprio aluno',
    text: 'O aluno entra no app com o e-mail dele.',
  },
  {
    value: 'GUARDIAN',
    title: 'Um responsável',
    text: 'O responsável entra e acompanha as aulas e pagamentos.',
  },
];

// Etapa 3 — quem acessa o app (usuário). O convite vai para este e-mail.
export function AccessStep({ form, errors, onChange }: StepProps) {
  // "Próximo" no teclado pula de campo em campo; o telefone (último) fecha.
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  return (
    <Card className="gap-5">
      <View>
        <Text
          className="text-lg"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Acesso ao app
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          Quem vai entrar no app para ver aulas e pagamentos?
        </Text>
      </View>

      <View className="gap-2.5">
        {HOLDER_OPTIONS.map((option) => {
          const selected = form.holder === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange({ holder: option.value })}
              activeOpacity={0.8}
              className="flex-row items-center gap-3 rounded-xl px-4 py-3.5"
              style={{
                backgroundColor: selected ? '#B08D57' : '#fff',
                borderWidth: 1,
                borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.1)',
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View
                className="w-5 h-5 rounded-full items-center justify-center"
                style={{
                  backgroundColor: selected ? '#fff' : 'transparent',
                  borderWidth: selected ? 0 : 2,
                  borderColor: '#D4CFC4',
                }}
              >
                {selected && (
                  <Check size={12} color="#B08D57" strokeWidth={3} />
                )}
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: selected ? '#fff' : '#1A1A1A' }}
                >
                  {option.title}
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{
                    color: selected ? 'rgba(255,255,255,0.9)' : '#6B7280',
                  }}
                >
                  {option.text}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {form.holder === 'GUARDIAN' && (
        <TextField
          label="Nome do responsável"
          required
          value={form.guardianName}
          onChangeText={(guardianName) => onChange({ guardianName })}
          error={errors.guardianName}
          placeholder="Ex: Maria Silva"
          autoCapitalize="words"
          maxLength={120}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      )}

      <TextField
        label="E-mail de acesso"
        required
        value={form.email}
        onChangeText={(email) => onChange({ email })}
        error={errors.email}
        hint="O convite para criar a senha será enviado para este e-mail."
        placeholder="email@exemplo.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        inputRef={emailRef}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />

      <TextField
        label="Telefone"
        value={form.phone}
        onChangeText={(text) => onChange({ phone: maskPhone(text) })}
        error={errors.phone}
        hint="Opcional. Se tiver WhatsApp, melhor."
        placeholder="(00) 00000-0000"
        keyboardType="phone-pad"
        maxLength={15}
        inputRef={phoneRef}
        returnKeyType="done"
      />

      <View
        className="flex-row items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ backgroundColor: '#F5F1EA' }}
      >
        <Mail size={16} color="#B08D57" style={{ marginTop: 2 }} />
        <Text className="text-xs text-gray-600 flex-1 leading-5">
          O e-mail terá o link para criar a senha e o link para baixar o app. O
          link vale por 7 dias.
        </Text>
      </View>
    </Card>
  );
}
