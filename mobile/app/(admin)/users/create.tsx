// app/(admin)/users/create.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, Share2, Check } from 'lucide-react-native';
import { api } from '../../../lib/api';
import { AdminTopBar } from '../../../components/AdminTopBar';

type Role = 'ADMIN' | 'STUDENT' | 'TEACHER';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'STUDENT', label: 'Aluno / Responsável' },
  { value: 'TEACHER', label: 'Professor' },
  { value: 'ADMIN', label: 'Administrador' },
];

export default function CreateUser() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Depois de criar, guardamos o link aqui pra exibir a tela de sucesso
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    if (!name || !email) {
      Alert.alert('Atenção', 'Preencha ao menos nome e email');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post('/users', { name, email, phone, role });
      setInviteLink(res.data.inviteLink);
      setCreatedName(res.data.name);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ?? 'Não foi possível criar o usuário';
      Alert.alert('Erro', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!inviteLink) return;
    await Share.share({
      message: `Olá! Crie sua senha de acesso ao Pianíssima por aqui: ${inviteLink}`,
    });
  }

  function handleDone() {
    // reseta o form pra criar outro, ou pode navegar de volta pra
    // lista de alunos — ajuste conforme sua navegação
    setInviteLink(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('STUDENT');
    router.back();
  }

  // ─── Estado: sucesso, mostrando o link ───
  if (inviteLink) {
    return (
      <View className="flex-1 bg-[#F5F1EA]">
        <AdminTopBar />
        <ScrollView className="px-5 mt-4" showsVerticalScrollIndicator={false}>
          <View
            className="bg-white rounded-2xl p-5 items-center"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="w-12 h-12 rounded-full bg-[#F3EADD] items-center justify-center mb-3">
              <Check size={24} color="#B08D57" />
            </View>
            <Text
              className="text-xl text-[#1A1A1A] text-center mb-1"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              {createdName} foi cadastrado(a)
            </Text>
            <Text className="text-gray-500 text-sm text-center mb-5">
              Envie o link abaixo para a pessoa criar a própria senha
            </Text>

            <View
              className="w-full rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: '#F5F1EA' }}
            >
              <Text className="text-[#1A1A1A] text-xs" numberOfLines={2}>
                {inviteLink}
              </Text>
            </View>

            <View className="flex-row gap-3 w-full mb-2">
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5"
                style={{ backgroundColor: '#F5F1EA' }}
                onPress={handleCopy}
              >
                {copied ? (
                  <Check size={16} color="#16A34A" />
                ) : (
                  <Copy size={16} color="#1A1A1A" />
                )}
                <Text className="font-semibold text-[#1A1A1A] text-sm">
                  {copied ? 'Copiado' : 'Copiar'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 bg-[#B08D57]"
                onPress={handleShare}
              >
                <Share2 size={16} color="#fff" />
                <Text className="font-semibold text-white text-sm">
                  Compartilhar
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            className="items-center py-4 mt-2"
            onPress={handleDone}
          >
            <Text className="text-gray-400 text-sm font-medium">Concluir</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Estado: formulário ───
  return (
    <View className="flex-1 bg-[#F5F1EA]">
      <AdminTopBar />
      <ScrollView
        className="px-5 mt-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          className="text-2xl text-[#1A1A1A] mb-4"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Novo usuário
        </Text>

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
              Nome
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{ backgroundColor: '#F5F1EA' }}
              placeholder="Nome completo"
              placeholderTextColor="#B0AA9C"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Email
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{ backgroundColor: '#F5F1EA' }}
              placeholder="email@exemplo.com"
              placeholderTextColor="#B0AA9C"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
              Telefone (opcional)
            </Text>
            <TextInput
              className="rounded-xl px-4 py-3 text-[#1A1A1A]"
              style={{ backgroundColor: '#F5F1EA' }}
              placeholder="(00) 00000-0000"
              placeholderTextColor="#B0AA9C"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View>
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Tipo de acesso
            </Text>
            <View className="flex-row gap-2">
              {ROLE_OPTIONS.map((option) => {
                const active = role === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setRole(option.value)}
                    className="flex-1 rounded-xl py-3 items-center"
                    style={{
                      backgroundColor: active ? '#B08D57' : '#F5F1EA',
                    }}
                  >
                    <Text
                      className="text-xs font-semibold text-center"
                      style={{ color: active ? '#fff' : '#1A1A1A' }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center mt-1"
            onPress={handleCreate}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.7 : 1 }}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Criando...' : 'Criar usuário'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
