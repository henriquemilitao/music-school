import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const CONFIRM_WORD = 'EXCLUIR';

type Step = 'warning' | 'confirm-word' | 'password' | 'success';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();

  const [step, setStep] = useState<Step>('warning');
  const [confirmWord, setConfirmWord] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const confirmWordMatches = confirmWord.trim().toUpperCase() === CONFIRM_WORD;

  async function handleDelete() {
    if (!password) {
      setError('Digite sua senha para confirmar');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.delete('/users/me', { data: { password } });
      setStep('success');
    } catch (err: any) {
      const message =
        err?.response?.data?.message ??
        'Não foi possível excluir sua conta. Tente novamente.';
      setError(message);
      setLoading(false);
    }
  }

  async function handleGoToLogin() {
    await signOut();
    router.replace('/login');
  }

  return (
    <View className="flex-1 bg-[#F5F1EA]">
      {step !== 'success' && (
        <View
          className="px-5 pb-3 flex-row items-center"
          style={{ paddingTop: insets.top + 12 }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center -ml-2"
          >
            <ChevronLeft size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text
            className="text-base ml-1"
            style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
          >
            Excluir conta
          </Text>
        </View>
      )}

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'warning' && (
          <View className="bg-white rounded-2xl p-5 mt-2">
            <View className="w-12 h-12 rounded-full bg-red-50 items-center justify-center mb-4">
              <AlertTriangle size={22} color="#DC2626" />
            </View>

            <Text
              className="text-lg mb-3"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Isso não pode ser desfeito
            </Text>

            <Text className="text-sm text-gray-600 leading-5 mb-3">
              Ao excluir sua conta:
            </Text>

            <View className="mb-2">
              <Text className="text-sm text-gray-600 leading-6">
                • Você perde o acesso ao app imediatamente
              </Text>
              <Text className="text-sm text-gray-600 leading-6">
                • Seu nome, e-mail e telefone são removidos permanentemente
              </Text>
              <Text className="text-sm text-gray-600 leading-6">
                • Dados de alunos vinculados à sua conta também são anonimizados
              </Text>
              <Text className="text-sm text-gray-600 leading-6">
                • O histórico de aulas e pagamentos é mantido de forma anônima,
                por exigência fiscal
              </Text>
            </View>

            <TouchableOpacity
              className="bg-[#DC2626] rounded-xl py-3.5 items-center mt-5"
              onPress={() => setStep('confirm-word')}
            >
              <Text className="text-white font-semibold text-sm">
                Continuar com a exclusão
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3.5 items-center"
              onPress={() => router.back()}
            >
              <Text className="text-gray-500 font-medium text-sm">
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'confirm-word' && (
          <View className="bg-white rounded-2xl p-5 mt-2">
            <Text
              className="text-lg mb-2"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Confirme a exclusão
            </Text>
            <Text className="text-sm text-gray-600 leading-5 mb-4">
              Para continuar, digite{' '}
              <Text className="font-bold text-[#1A1A1A]">EXCLUIR</Text> no campo
              abaixo.
            </Text>

            <TextInput
              value={confirmWord}
              onChangeText={setConfirmWord}
              placeholder="Digite EXCLUIR"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoCorrect={false}
              className="bg-[#F5F1EA] rounded-xl px-4 py-3.5 text-[15px] mb-4"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
                color: '#1A1A1A',
              }}
            />

            <TouchableOpacity
              disabled={!confirmWordMatches}
              className="rounded-xl py-3.5 items-center"
              style={{
                backgroundColor: confirmWordMatches ? '#DC2626' : '#E5E5E5',
              }}
              onPress={() => setStep('password')}
            >
              <Text
                className="font-semibold text-sm"
                style={{ color: confirmWordMatches ? 'white' : '#9CA3AF' }}
              >
                Continuar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3.5 items-center"
              onPress={() => {
                setStep('warning');
                setConfirmWord('');
              }}
            >
              <Text className="text-gray-500 font-medium text-sm">Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'password' && (
          <View className="bg-white rounded-2xl p-5 mt-2">
            <Text
              className="text-lg mb-2"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Confirme sua senha
            </Text>
            <Text className="text-sm text-gray-600 leading-5 mb-4">
              Por segurança, digite sua senha atual para excluir a conta
              definitivamente.
            </Text>

            <View
              className="flex-row items-center bg-[#F5F1EA] rounded-xl mb-2"
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError('');
                }}
                placeholder="Sua senha"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                className="flex-1 px-4 py-3.5 text-[15px]"
                style={{ color: '#1A1A1A' }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                className="px-3.5"
              >
                {showPassword ? (
                  <EyeOff size={20} color="#B0AA9C" />
                ) : (
                  <Eye size={20} color="#B0AA9C" />
                )}
              </TouchableOpacity>
            </View>

            {!!error && (
              <Text className="text-red-600 text-xs mb-2">{error}</Text>
            )}

            <TouchableOpacity
              disabled={loading || !password}
              className="rounded-xl py-3.5 items-center mt-3"
              style={{
                backgroundColor: !password ? '#E5E5E5' : '#DC2626',
                opacity: loading ? 0.7 : 1,
              }}
              onPress={() => {
                Alert.alert(
                  'Excluir conta',
                  'Tem certeza? Essa ação não pode ser desfeita.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Excluir',
                      style: 'destructive',
                      onPress: handleDelete,
                    },
                  ],
                );
              }}
            >
              <Text
                className="font-semibold text-sm"
                style={{ color: !password ? '#9CA3AF' : 'white' }}
              >
                {loading ? 'Excluindo...' : 'Excluir minha conta'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-3.5 items-center"
              onPress={() => {
                setStep('confirm-word');
                setPassword('');
                setError('');
              }}
            >
              <Text className="text-gray-500 font-medium text-sm">Voltar</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'success' && (
          <View className="flex-1 items-center justify-center pt-24">
            <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-5">
              <CheckCircle2 size={30} color="#16A34A" />
            </View>

            <Text
              className="text-xl mb-2"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Conta excluída
            </Text>

            <Text className="text-sm text-gray-600 text-center leading-5 px-6 mb-8">
              Sua conta foi excluída com sucesso. Sentiremos sua falta por aqui.
              🎵
            </Text>

            <TouchableOpacity
              className="bg-[#B08D57] rounded-xl py-3.5 px-8 items-center"
              onPress={handleGoToLogin}
            >
              <Text className="text-white font-semibold text-sm">
                Voltar ao login
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
