import { useState, useEffect } from 'react';
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
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const logo = require('../assets/images/logo.png');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
          paddingTop: isKeyboardVisible ? 130 : 0,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        className="px-6"
      >
        <View className="items-center mb-10">
          {!isKeyboardVisible && (
            <Image
              source={logo}
              style={{ width: 202, height: 202 }}
              resizeMode="contain"
            />
          )}
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
                borderWidth: isEmailFocused ? 1.5 : 1,
                borderColor: isEmailFocused ? '#B08D57' : 'rgba(0,0,0,0.08)',
                backgroundColor: '#F5F1EA',
              }}
              placeholder="seu@email.com"
              placeholderTextColor="#B0AA9C"
              value={email}
              onChangeText={setEmail}
              onFocus={() => setIsEmailFocused(true)}
              onBlur={() => setIsEmailFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Senha
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
                onChangeText={setPassword}
                onFocus={() => setIsPasswordFocused(true)}
                onBlur={() => setIsPasswordFocused(false)}
                secureTextEntry={!showPassword}
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
            onPress={handleLogin}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isKeyboardVisible && (
          <Text className="text-center text-gray-400 text-xs mt-8">
            Pianíssima · Aqui tem música
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
