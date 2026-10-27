import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Trash2, UserMinus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { confirmAsync } from '../../lib/confirm';
import { firstName, namesMatch } from '../../lib/name';
import {
  deleteStudentPermanently,
  useRefreshStudentData,
} from '../../lib/studentAdmin';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { TextField } from '../../components/form/FormField';

type StudentLite = {
  id: string;
  name: string;
  isActive: boolean;
  user: { name: string };
};

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View className="flex-row gap-2.5">
      <View
        className="w-1.5 h-1.5 rounded-full mt-2"
        style={{ backgroundColor: '#DC2626' }}
      />
      <Text className="flex-1 text-sm text-[#7F1D1D] leading-5">
        {children}
      </Text>
    </View>
  );
}

// Exclusão DEFINITIVA do aluno e de tudo ligado a ele. Três travas: digitar o
// nome completo + duas confirmações em diálogo.
export default function DeleteStudent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refreshStudent = useRefreshStudentData();

  const { data: student, isLoading } = useQuery({
    queryKey: ['admin-student', id],
    queryFn: async () => (await api.get<StudentLite>(`/students/${id}`)).data,
    enabled: !!id,
  });

  const [typedName, setTypedName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: (name: string) => deleteStudentPermanently(id, name),
    onSuccess: () => {
      refreshStudent(id, { removed: true });
      // O detalhe deste aluno não existe mais: volta direto pra lista
      router.dismissTo('/(admin)/students');
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível excluir. Tente novamente.',
      );
    },
  });

  async function handleDelete() {
    if (!student) return;
    setSubmitError(null);

    const first = await confirmAsync({
      title: 'Excluir definitivamente?',
      message: `Você vai apagar TUDO de ${student.name}: aulas, faturas, matrícula e cadastro. Não dá para desfazer.`,
      confirmText: 'Continuar',
      destructive: true,
    });
    if (!first) return;

    const second = await confirmAsync({
      title: 'Última confirmação',
      message: `Excluir ${student.name} e todos os dados agora?`,
      confirmText: 'Excluir tudo',
      destructive: true,
    });
    if (!second) return;

    remove.mutate(typedName);
  }

  if (isLoading || !student) {
    return (
      <DetailScreen title="Excluir aluno">
        <View className="py-20 items-center">
          {isLoading ? (
            <ActivityIndicator size="large" color="#B08D57" />
          ) : (
            <Text className="text-sm text-gray-500">Aluno não encontrado</Text>
          )}
        </View>
      </DetailScreen>
    );
  }

  const matches = namesMatch(typedName, student.name);

  return (
    <DetailScreen
      title="Excluir aluno"
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label="Excluir tudo definitivamente"
            variant="danger"
            icon={Trash2}
            onPress={() => void handleDelete()}
            disabled={!matches}
            loading={remove.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        <View
          className="rounded-2xl p-5 gap-3"
          style={{
            backgroundColor: '#FEF2F2',
            borderWidth: 1,
            borderColor: '#FCA5A5',
          }}
        >
          <View className="flex-row items-center gap-2">
            <AlertTriangle size={18} color="#DC2626" />
            <Text className="text-base font-bold text-[#991B1B] flex-1">
              Excluir {firstName(student.name)} por completo?
            </Text>
          </View>
          <View className="gap-2">
            <Bullet>Todas as aulas (passadas e futuras) e anotações</Bullet>
            <Bullet>Todas as faturas e pagamentos</Bullet>
            <Bullet>A matrícula e o cadastro do aluno</Bullet>
            <Bullet>
              A conta de {student.user.name}, se não houver outro aluno ligado a
              ela
            </Bullet>
          </View>
          <Text className="text-sm font-semibold text-[#991B1B]">
            Isso não pode ser desfeito.
          </Text>
        </View>

        {student.isActive && (
          <Card className="gap-3">
            <Text className="text-sm font-semibold">
              Quer só parar as aulas?
            </Text>
            <Text className="text-sm text-gray-500 -mt-1.5">
              Encerrar a matrícula tira o aluno da lista de ativos e da agenda,
              mas mantém o histórico de aulas e faturas.
            </Text>
            <Button
              label="Encerrar matrícula em vez disso"
              variant="secondary"
              icon={UserMinus}
              onPress={() => router.replace(`/enrollment-end/${id}`)}
            />
          </Card>
        )}

        <Card className="gap-4">
          <Text className="text-sm text-[#1A1A1A] leading-5">
            Para confirmar, digite o nome completo do aluno:{' '}
            <Text className="font-bold">{student.name}</Text>
          </Text>
          <TextField
            label="Nome do aluno"
            value={typedName}
            onChangeText={(text) => {
              setTypedName(text);
              setSubmitError(null);
            }}
            placeholder={student.name}
            autoCapitalize="words"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="done"
          />
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
