import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { api } from '../lib/api';

const logo = require('../assets/images/logo.png');

type InviteState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'valid'; name: string; email: string };

export default function SetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [invite, setInvite] = useState<InviteState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const confirmInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () =>
      setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(hideEvent, () =>
      setIsKeyboardVisible(false),
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setInvite({ status: 'invalid' });
        return;
      }

      try {
        const res = await api.get('/auth/invite/validate', {
          params: { token },
        });
        setInvite({
          status: 'valid',
          name: res.data.name,
          email: res.data.email,
        });
      } catch {
        setInvite({ status: 'invalid' });
      }
    }

    validateToken();
  }, [token]);

  async function handleSetPassword() {
    if (!password || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha os dois campos de senha');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Atenção', 'A senha precisa ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/set-password', { token, password });
      Alert.alert(
        'Pronto!',
        'Sua senha foi criada. Faça login para continuar.',
        [{ text: 'OK', onPress: () => router.replace('/login') }],
      );
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível definir sua senha. O link pode ter expirado — peça um novo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (invite.status === 'loading') {
    return (
      <View className="flex-1 bg-[#F5F1EA] items-center justify-center">
        <ActivityIndicator color="#B08D57" />
        <Text className="text-gray-400 text-sm mt-3">Validando convite...</Text>
      </View>
    );
  }

  if (invite.status === 'invalid') {
    return (
      <View className="flex-1 bg-[#F5F1EA] items-center justify-center px-8">
        <Text
          className="text-2xl text-[#1A1A1A] text-center mb-2"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Link inválido ou expirado
        </Text>
        <Text className="text-gray-500 text-center text-sm mb-8">
          Peça para a escola gerar um novo link de ativação para você.
        </Text>
        <TouchableOpacity
          className="bg-[#B08D57] rounded-xl py-4 px-8 items-center"
          onPress={() => router.replace('/login')}
        >
          <Text className="text-white font-bold text-base">
            Ir para o login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F1EA]"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
          paddingTop: isKeyboardVisible ? 80 : 0,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="px-6"
      >
        <View className="items-center mb-8 mt-10">
          {!isKeyboardVisible && (
            <Image
              source={logo}
              style={{ width: 240, height: 240 }}
              resizeMode="contain"
            />
          )}
          <Text
            className="text-3xl text-[#1A1A1A] text-center"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            Criar senha
          </Text>
          {!isKeyboardVisible && (
            <Text className="text-gray-500 text-sm text-center mt-2">
              Olá, {invite.name}! Defina uma senha para {invite.email}
            </Text>
          )}
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
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#B0AA9C"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                secureTextEntry={!showPassword}
                returnKeyType="next"
                onSubmitEditing={() => confirmInputRef.current?.focus()}
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
            <View
              className="rounded-xl flex-row items-center"
              style={{
                borderWidth: isConfirmFocused ? 1.5 : 1,
                borderColor: isConfirmFocused ? '#B08D57' : 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
            >
              <TextInput
                ref={confirmInputRef}
                className="flex-1 px-4 py-3 text-[#1A1A1A]"
                placeholder="Repita a senha"
                placeholderTextColor="#B0AA9C"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setIsConfirmFocused(true)}
                onBlur={() => setIsConfirmFocused(false)}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
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

          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center mt-1"
            onPress={handleSetPassword}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Salvando...' : 'Criar senha e continuar'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
