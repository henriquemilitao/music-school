import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../../lib/api';
import { InlineFeedback } from '../../components/ui/InlineFeedback';

// Validação simples de formato — não pega tudo (nenhuma regex pega),
// mas barra os erros de digitação mais comuns antes de gastar uma
// requisição (ex: esquecer o @, esquecer o domínio).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit() {
    setErrorMessage(null);

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrorMessage('Preencha seu email para continuar');
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage('Digite um email válido');
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();
    try {
      // O backend SEMPRE retorna a mesma mensagem genérica aqui,
      // exista o e-mail cadastrado ou não — não dá pra saber pela
      // resposta se deu certo de verdade. Navegamos pra tela de
      // código de qualquer forma; se o e-mail não existir, o
      // usuário só não vai receber nada e pode voltar.
      await api.post('/auth/forgot-password', { email: trimmedEmail });

      // replace (não push) — a tela de email sai da pilha. Assim,
      // se o usuário apertar voltar na tela de código, ele vai
      // direto pro login, em vez de cair de novo aqui e arriscar
      // reenviar o código sem querer.
      router.replace({
        pathname: '/(auth)/verify-code',
        params: { email: trimmedEmail },
      });
    } catch (error: any) {
      // Erro de rede puro (sem resposta do servidor) vs erro que o
      // backend devolveu de propósito — tratamos os dois, pra nunca
      // deixar a tela num estado sem feedback nenhum.
      if (!error?.response) {
        setErrorMessage(
          'Não foi possível conectar. Verifique sua internet e tente novamente.',
        );
      } else {
        setErrorMessage(
          error?.friendlyMessage ??
            'Não foi possível enviar o código. Tente novamente.',
        );
      }
    } finally {
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
            Esqueceu sua senha?
          </Text>
          <Text className="text-sm text-gray-500 text-center mt-2 px-4">
            Digite seu email e enviaremos um código de verificação para você
            criar uma nova senha.
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

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Email
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{
                borderWidth: isEmailFocused ? 1.5 : 1,
                borderColor: isEmailFocused ? '#B08D57' : 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
              placeholder="seu@email.com"
              placeholderTextColor="#B0AA9C"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="send"
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
              {isSubmitting ? 'Enviando...' : 'Enviar código'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
