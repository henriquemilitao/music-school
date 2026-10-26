import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, Mail, Send } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import { Card } from '../../ui/Card';
import { InlineFeedback } from '../../ui/InlineFeedback';
import { api } from '../../../lib/api';
import { weekdayName, type NewStudentForm } from '../../../lib/newStudent';

export type CreatedStudent = {
  userId: string;
  studentId: string;
  email: string;
  inviteLink: string;
  emailSent: boolean;
};

type SuccessViewProps = {
  form: NewStudentForm;
  created: CreatedStudent;
  onOpenStudent: () => void;
  onCreateAnother: () => void;
  onBackToList: () => void;
};

// Tela final: confirma o cadastro e deixa claro o que aconteceu com o
// e-mail de convite. Se o e-mail falhou, o cadastro NÃO se perdeu — o admin
// pode reenviar ou copiar o link e mandar por WhatsApp.
export function SuccessView({
  form,
  created,
  onOpenStudent,
  onCreateAnother,
  onBackToList,
}: SuccessViewProps) {
  const [emailSent, setEmailSent] = useState(created.emailSent);
  const [inviteLink, setInviteLink] = useState(created.inviteLink);
  const [copied, setCopied] = useState(false);

  const resend = useMutation({
    mutationFn: async () => {
      const response = await api.post<{ inviteLink: string }>(
        `/auth/invite/${created.userId}/resend`,
      );
      return response.data;
    },
    onSuccess: (data) => {
      setInviteLink(data.inviteLink);
      setEmailSent(true);
    },
  });

  async function copyLink() {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const weekday = weekdayName(form.firstLessonDate);

  return (
    <View className="gap-4">
      <View className="items-center pt-2 pb-1">
        <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
          <Check size={30} color="#16A34A" />
        </View>
        <Text
          className="text-2xl text-center"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Aluno cadastrado!
        </Text>
        <Text className="text-sm text-gray-500 text-center mt-1.5 px-4">
          {form.studentName.trim()} já está na lista
          {weekday ? `, com aulas toda ${weekday} às ${form.startTime}` : ''}.
        </Text>
      </View>

      {emailSent ? (
        <InlineFeedback
          type="success"
          message={`Convite enviado para ${created.email}`}
        />
      ) : (
        <Card className="gap-3">
          <InlineFeedback
            type="warning"
            message="O aluno foi cadastrado, mas o e-mail não saiu."
          />
          <Text className="text-sm text-gray-600 leading-5">
            Reenvie o convite ou copie o link e mande por WhatsApp.
          </Text>
          {resend.isError && (
            <InlineFeedback
              type="error"
              message="Não foi possível reenviar. Tente de novo."
            />
          )}
          <View className="flex-row gap-2.5">
            <TouchableOpacity
              onPress={() => resend.mutate()}
              disabled={resend.isPending}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#B08D57] h-11"
              accessibilityRole="button"
              accessibilityLabel="Reenviar convite por e-mail"
            >
              {resend.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={15} color="#fff" />
                  <Text className="text-white font-semibold text-sm">
                    Reenviar e-mail
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void copyLink()}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl h-11"
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' }}
              accessibilityRole="button"
              accessibilityLabel="Copiar link do convite"
            >
              {copied ? (
                <Check size={15} color="#16A34A" />
              ) : (
                <Copy size={15} color="#1A1A1A" />
              )}
              <Text className="font-semibold text-sm text-[#1A1A1A]">
                {copied ? 'Copiado!' : 'Copiar link'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      <Card className="gap-2.5">
        <View className="flex-row items-center gap-2">
          <Mail size={14} color="#B08D57" />
          <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
            Próximos passos
          </Text>
        </View>
        <Text className="text-sm text-gray-600 leading-5">
          1. A pessoa abre o e-mail e cria a senha pelo link (vale por 7 dias).
        </Text>
        <Text className="text-sm text-gray-600 leading-5">
          2. Baixa o app e entra com o e-mail e a senha criada.
        </Text>
      </Card>

      <View className="gap-2.5 pt-1">
        <TouchableOpacity
          onPress={onOpenStudent}
          className="items-center justify-center rounded-xl bg-[#1A1A1A] h-12"
          accessibilityRole="button"
        >
          <Text className="text-white font-semibold">Ver aluno</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCreateAnother}
          className="items-center justify-center rounded-xl h-12"
          style={{
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.12)',
            backgroundColor: '#fff',
          }}
          accessibilityRole="button"
        >
          <Text className="font-semibold text-[#1A1A1A]">
            Cadastrar outro aluno
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBackToList}
          className="items-center justify-center h-10"
          accessibilityRole="button"
        >
          <Text className="text-sm text-gray-500">Voltar para a lista</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
