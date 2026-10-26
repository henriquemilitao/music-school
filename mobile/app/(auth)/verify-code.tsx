import { useState, useRef, useEffect } from 'react';
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
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../../lib/api';
import { InlineFeedback } from '../../components/ui/InlineFeedback';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyCode() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const router = useRouter();

  const code = digits.join('');
  const isCodeComplete = code.length === CODE_LENGTH;

  // Guarda contra a tela ser aberta sem email (ex: link direto, ou
  // navegação fora do fluxo esperado) — sem isso, a chamada de API
  // sai com email undefined e o erro que volta é confuso pro usuário.
  useEffect(() => {
    if (!email) {
      router.replace('/(auth)/forgot-password');
    }
  }, [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function submitCode(fullCode: string) {
    if (fullCode.length !== CODE_LENGTH || !email) return;

    setErrorMessage(null);
    setIsSubmitting(true);
    Keyboard.dismiss();
    try {
      await api.post('/auth/reset-password/validate', {
        email,
        code: fullCode,
      });

      // replace (não push) — a tela de código sai da pilha. Assim,
      // se o usuário apertar voltar na tela de nova senha, ele vai
      // direto pro login.
      router.replace({
        pathname: '/(auth)/reset-password',
        params: { email, code: fullCode },
      });
    } catch (error: any) {
      if (!error?.response) {
        setErrorMessage(
          'Não foi possível conectar. Verifique sua internet e tente novamente.',
        );
      } else {
        setErrorMessage(
          error?.friendlyMessage ??
            'Código inválido ou expirado. Solicite um novo código.',
        );
      }
      setDigits(Array(CODE_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChangeDigit(text: string, index: number) {
    if (errorMessage) setErrorMessage(null);

    // Aceita colar o código inteiro de uma vez (ex: usuário copiou do email)
    if (text.length > 1) {
      const pasted = text.replace(/\D/g, '').slice(0, CODE_LENGTH).split('');
      const newDigits = Array(CODE_LENGTH).fill('');
      pasted.forEach((d, i) => (newDigits[i] = d));
      setDigits(newDigits);

      if (pasted.length === CODE_LENGTH) {
        submitCode(pasted.join(''));
        return;
      }

      const nextIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputsRef.current[nextIndex]?.focus();
      return;
    }

    if (!/^\d?$/.test(text)) return;

    const newDigits = [...digits];
    newDigits[index] = text;
    setDigits(newDigits);

    if (text && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit assim que o último dígito é preenchido.
    if (text && index === CODE_LENGTH - 1) {
      const fullCode = newDigits.join('');
      if (fullCode.length === CODE_LENGTH) {
        submitCode(fullCode);
      }
    }
  }

  function handleKeyPress(e: any, index: number) {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    if (!email) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccessMessage('Código reenviado! Verifique seu email.');
      setDigits(Array(CODE_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      if (!error?.response) {
        setErrorMessage(
          'Não foi possível conectar. Verifique sua internet e tente novamente.',
        );
      } else {
        setErrorMessage(
          error?.friendlyMessage ??
            'Não foi possível reenviar o código. Tente novamente.',
        );
      }
    } finally {
      setIsResending(false);
    }
  }

  const canResend = cooldown === 0 && !isResending;

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
            Digite o código
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2 px-4">
            Enviamos um código de 6 dígitos para{' '}
            <Text className="font-semibold text-[#1A1A1A]">{email}</Text>
          </Text>
        </View>

        <View
          className="bg-white rounded-2xl p-5 gap-5"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <InlineFeedback type="error" message={errorMessage} />
          <InlineFeedback type="success" message={successMessage} />

          <View className="flex-row justify-between">
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputsRef.current[index] = ref;
                }}
                className="rounded-xl text-center text-[#1A1A1A] text-xl font-bold"
                style={{
                  width: 44,
                  height: 52,
                  borderWidth: digit ? 1.5 : 1,
                  borderColor: digit ? '#B08D57' : 'rgba(0,0,0,0.08)',
                  backgroundColor: '#F5F1EA',
                }}
                value={digit}
                editable={!isSubmitting}
                onChangeText={(text) => handleChangeDigit(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                textAlign="center"
              />
            ))}
          </View>

          {/* Botão manual — rede de segurança caso o auto-submit
              falhe silenciosamente, ou o usuário volte pra esta tela
              com os 6 dígitos já preenchidos. */}
          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center"
            onPress={() => submitCode(code)}
            disabled={isSubmitting || !isCodeComplete}
            style={{ opacity: isSubmitting || !isCodeComplete ? 0.5 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Verificando...' : 'Verificar código'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={!canResend}
            className="items-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: canResend ? '#B08D57' : '#B0AA9C' }}
            >
              {isResending
                ? 'Reenviando...'
                : cooldown > 0
                  ? `Reenviar código em ${cooldown}s`
                  : 'Não recebeu? Reenviar código'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
