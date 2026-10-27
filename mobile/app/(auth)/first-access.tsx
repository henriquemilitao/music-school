import { useState } from 'react';
import { Keyboard, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MailCheck, MailQuestion, ShieldCheck } from 'lucide-react-native';
import { api } from '../../lib/api';
import { isValidEmail } from '../../lib/validation';
import { useResendCooldown } from '../../lib/useResendCooldown';
import { AuthScreenLayout } from '../../components/auth/AuthScreenLayout';
import { AuthCard } from '../../components/auth/AuthCard';
import { AuthButton } from '../../components/auth/AuthButton';
import { AuthTextField } from '../../components/auth/AuthTextField';
import { InlineFeedback } from '../../components/ui/InlineFeedback';

type FirstAccessStatus = 'SENT' | 'NOT_REGISTERED' | 'ALREADY_ACTIVE';

// 'form' = digitando o e-mail; os demais são o resultado devolvido pela API
type Phase = 'form' | FirstAccessStatus;

const RESEND_COOLDOWN_SECONDS = 60;

// Ícone grande + título + texto, usado nos três resultados possíveis
function ResultMessage({
  icon: Icon,
  tint,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  tint: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="items-center gap-2 pt-1">
      <View
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{ backgroundColor: `${tint}1F` }}
      >
        <Icon size={26} color={tint} />
      </View>
      <Text
        className="text-lg text-center text-[#1A1A1A]"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {title}
      </Text>
      <Text className="text-sm text-gray-500 text-center leading-5">
        {children}
      </Text>
    </View>
  );
}

export default function FirstAccess() {
  const router = useRouter();
  // O login pode mandar o e-mail que a pessoa já tinha digitado
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [phase, setPhase] = useState<Phase>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resend = useResendCooldown();

  const trimmedEmail = email.trim();

  async function requestLink() {
    setErrorMessage(null);

    if (!trimmedEmail) {
      setErrorMessage('Preencha seu e-mail para continuar');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      setErrorMessage('Digite um e-mail válido');
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();
    try {
      const response = await api.post<{ status: FirstAccessStatus }>(
        '/auth/first-access',
        { email: trimmedEmail },
      );
      setPhase(response.data.status);
      if (response.data.status === 'SENT') {
        resend.start(RESEND_COOLDOWN_SECONDS);
      }
    } catch (error: any) {
      setErrorMessage(
        error?.friendlyMessage ??
          'Não foi possível enviar o link. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function backToForm() {
    setErrorMessage(null);
    setPhase('form');
  }

  function goToLogin() {
    router.replace('/(auth)/login');
  }

  return (
    <AuthScreenLayout
      title="Criar minha senha"
      subtitle={
        phase === 'form'
          ? 'Use o e-mail que você informou para a escola. Enviaremos um link para você criar sua senha.'
          : undefined
      }
    >
      <AuthCard>
        {phase === 'form' && (
          <>
            <InlineFeedback type="error" message={errorMessage} />
            <AuthTextField
              label="E-mail"
              placeholder="seu@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={requestLink}
            />
            <AuthButton
              label={isSubmitting ? 'Enviando...' : 'Enviar link'}
              onPress={requestLink}
              loading={isSubmitting}
            />
          </>
        )}

        {phase === 'SENT' && (
          <>
            <ResultMessage
              icon={MailCheck}
              tint="#16A34A"
              title="Link enviado!"
            >
              Enviamos o link para{' '}
              <Text className="font-semibold text-[#1A1A1A]">
                {trimmedEmail}
              </Text>
              . Abra o e-mail e toque em “Criar senha”. Se não encontrar, olhe
              também a caixa de spam.
            </ResultMessage>

            <InlineFeedback type="error" message={errorMessage} />
            <AuthButton label="Voltar ao login" onPress={goToLogin} />

            <View className="flex-row justify-center gap-1 flex-wrap">
              {resend.seconds > 0 ? (
                <Text className="text-xs text-gray-400">
                  Não chegou? Você poderá reenviar em {resend.seconds}s
                </Text>
              ) : (
                <>
                  <Text className="text-xs text-gray-500">Não chegou?</Text>
                  <TouchableOpacity
                    onPress={requestLink}
                    disabled={isSubmitting}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text className="text-xs font-semibold text-[#B08D57]">
                      Reenviar link
                    </Text>
                  </TouchableOpacity>
                  <Text className="text-xs text-gray-500">ou</Text>
                  <TouchableOpacity
                    onPress={backToForm}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text className="text-xs font-semibold text-[#B08D57]">
                      usar outro e-mail
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </>
        )}

        {phase === 'NOT_REGISTERED' && (
          <>
            <ResultMessage
              icon={MailQuestion}
              tint="#D97706"
              title="E-mail ainda não cadastrado"
            >
              Não encontramos{' '}
              <Text className="font-semibold text-[#1A1A1A]">
                {trimmedEmail}
              </Text>{' '}
              na escola. Peça para a escola cadastrar esse e-mail e depois volte
              aqui para criar sua senha.
            </ResultMessage>
            <AuthButton label="Tentar outro e-mail" onPress={backToForm} />
            <AuthButton
              label="Voltar ao login"
              onPress={goToLogin}
              variant="secondary"
            />
          </>
        )}

        {phase === 'ALREADY_ACTIVE' && (
          <>
            <ResultMessage
              icon={ShieldCheck}
              tint="#B08D57"
              title="Você já tem uma senha"
            >
              Esse e-mail já está pronto para uso. Entre com sua senha — se não
              lembrar, use “Esqueci minha senha”.
            </ResultMessage>
            <AuthButton label="Ir para o login" onPress={goToLogin} />
            <AuthButton
              label="Esqueci minha senha"
              onPress={() => router.replace('/(auth)/forgot-password')}
              variant="secondary"
            />
          </>
        )}
      </AuthCard>
    </AuthScreenLayout>
  );
}
