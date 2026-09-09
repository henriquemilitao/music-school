import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { api } from '../../lib/api';
import { InlineFeedback } from '../../components/ui/InlineFeedback';

export default function ResetPassword() {
  const { email, code } = useLocalSearchParams<{
    email?: string;
    code?: string;
  }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  const router = useRouter();

  // Guarda contra a tela ser aberta sem email/code (ex: navegação
  // fora do fluxo esperado) — sem isso, o POST sai com parâmetros
  // undefined e a tela fica "quebrada" sem explicação nenhuma.
  useEffect(() => {
    if (!email || !code) {
      router.replace('/(auth)/forgot-password');
    }
  }, [email, code]);

  async function handleSubmit() {
    setErrorMessage(null);

    if (!email || !code) return;

    if (!password || !confirmPassword) {
      setErrorMessage('Preencha os dois campos');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();
    try {
      // O backend revalida o código aqui de novo — nunca confia só
      // na validação que já rolou na tela anterior.
      await api.post('/auth/reset-password', { email, code, password });

      setSuccessMessage('Senha alterada com sucesso! Redirecionando...');

      // pequeno delay só pra dar tempo do usuário ler a mensagem de
      // sucesso antes de trocar de tela
      setTimeout(() => {
        router.replace({
          pathname: '/(auth)/login',
          params: { email },
        });
      }, 1200);
    } catch (error: any) {
      if (!error?.response) {
        setErrorMessage(
          'Não foi possível conectar. Verifique sua internet e tente novamente.',
        );
      } else {
        setErrorMessage(
          error?.friendlyMessage ??
            'Não foi possível redefinir sua senha. O código pode ter expirado — tente novamente desde o início.',
        );
      }
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex bg-[#F5F1EA]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-start',
          paddingTop: 120,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="px-6"
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-14 z-10 w-10 h-10 items-center justify-center"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={26} color="#1A1A1A" />
        </TouchableOpacity>

        <View className="items-center mb-8">
          <Text
            className="text-3xl text-[#1A1A1A] text-center"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            Nova senha
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2 px-4">
            Crie uma nova senha para acessar sua conta.
          </Text>
        </View>

        <View
          className="bg-white rounded-2xl p-5 gap-4"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <InlineFeedback type="error" message={errorMessage} />
          <InlineFeedback type="success" message={successMessage} />

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Nova senha
            </Text>
            <View
              className="rounded-xl flex-row items-center"
              style={{
                borderWidth: isPasswordFocused ? 1.5 : 1,
                borderColor: isPasswordFocused ? '#B08D57' : 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
            >
              <TextInput
                className="flex-1 px-4 py-3 text-[#1A1A1A]"
                placeholder="••••••••"
                placeholderTextColor="#B0AA9C"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                secureTextEntry={!showPassword}
                editable={!isSubmitting}
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                className="px-4"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#B0AA9C" />
                ) : (
                  <Eye size={20} color="#B0AA9C" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Confirmar senha
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{
                borderWidth: isConfirmFocused ? 1.5 : 1,
                borderColor: isConfirmFocused ? '#B08D57' : 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
              placeholder="••••••••"
              placeholderTextColor="#B0AA9C"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onFocus={() => setIsConfirmFocused(true)}
              onBlur={() => setIsConfirmFocused(false)}
              secureTextEntry={!showPassword}
              editable={!isSubmitting}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center mt-1"
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Salvando...' : 'Salvar nova senha'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
