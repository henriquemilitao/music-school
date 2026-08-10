import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

const logo = require('../assets/images/logo.jpeg');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Atenção', 'Preencha email e senha');
      return;
    }

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      Alert.alert('Erro', 'Email ou senha inválidos');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#F5F1EA]"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-6">
        <View className="items-center mb-10">
          <Image
            source={logo}
            style={{ width: 202, height: 202 }}
            resizeMode="contain"
          />
          {/* <Text className="text-xs tracking-[3px] text-[#B08D57] font-bold mt-4">
            AQUI TEM MÚSICA
          </Text> */}
          <Text
            className="text-3xl text-[#1A1A1A]"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            Bem-vindo
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
          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Email
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
              placeholder="seu@email.com"
              placeholderTextColor="#B0AA9C"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Senha
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
              placeholder="••••••••"
              placeholderTextColor="#B0AA9C"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center mt-1"
            onPress={handleLogin}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text className="text-center text-gray-400 text-xs mt-8">
          Pianíssima · Aqui tem música
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
