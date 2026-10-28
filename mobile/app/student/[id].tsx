import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ellipsis, Music2, Trash2, UserMinus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import { firstName } from '../../lib/name';
import { adminLessonKeys } from '../../lib/queryKeys';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import {
  ActionMenu,
  type ActionMenuItem,
} from '../../components/ui/ActionMenu';
import { Badge } from '../../components/student/detail/Badge';
import {
  EnrollmentCard,
  type EnrollmentSummary,
} from '../../components/student/detail/EnrollmentCard';
import {
  LessonMonthGroup,
  lessonMonthKey,
  type StudentLesson,
} from '../../components/student/detail/LessonMonthGroup';
import {
  PaymentsList,
  type StudentPayment,
} from '../../components/student/detail/PaymentsList';
import {
  StudentProfileCard,
  type StudentProfile,
} from '../../components/student/detail/StudentProfileCard';

// ─── Tipos ────────────────────────────────────────────────────────────

type StudentDetail = StudentProfile & {
  id: string;
  instrument: string | null;
  // Backend antigo não manda: só `false` explícito é inativo
  isActive?: boolean;
};

// Status agregado — vem de um endpoint leve, não da lista completa de faturas
type PaymentStatusSummary = {
  status: 'OK' | 'PENDING' | 'OVERDUE';
};

type TabKey = 'geral' | 'aulas' | 'faturas';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'geral', label: 'Visão geral' },
  { key: 'aulas', label: 'Aulas' },
  { key: 'faturas', label: 'Faturas' },
];

// Status agregado da matrícula (Em dia / Pendente / Atrasado)
function matriculaStatusConfig(status: PaymentStatusSummary['status']) {
  if (status === 'OVERDUE')
    return { label: 'Atrasado', bg: '#FEF2F2', text: '#DC2626' };
  if (status === 'PENDING')
    return { label: 'Pendente', bg: '#FFFBEB', text: '#D97706' };
  return { label: 'Em dia', bg: '#ECFDF5', text: '#059669' };
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center py-8">
      <Text className="text-sm text-gray-400">{text}</Text>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────

export default function AdminStudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('geral');
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ['admin-student', id],
    queryFn: async () => {
      const response = await api.get<StudentDetail>(`/students/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: enrollment, isLoading: loadingEnrollment } = useQuery({
    queryKey: ['admin-student-enrollment', id],
    queryFn: async () => {
      const response = await api.get<EnrollmentSummary | null>(
        `/enrollments/student/${id}`,
      );
      return response.data;
    },
    enabled: !!id,
  });

  // Status agregado de pagamento — endpoint leve (não traz a lista de
  // faturas inteira, só o status já calculado no backend).
  const { data: paymentStatus, isLoading: loadingPaymentStatus } = useQuery({
    queryKey: ['admin-student-payment-status', id],
    queryFn: async () => {
      const response = await api.get<PaymentStatusSummary>(
        `/payments/student/${id}/status`,
      );
      return response.data;
    },
    enabled: !!id,
  });

  const { data: lessons, isLoading: loadingLessons } = useQuery({
    queryKey: adminLessonKeys.byStudent(id),
    queryFn: async () => {
      const response = await api.get<StudentLesson[]>(`/lessons/student/${id}`);
      return response.data;
    },
    enabled: !!id && tab === 'aulas',
  });

  // Lista completa de faturas — só carregada quando o admin abre a aba
  // "Faturas", pra não trazer N faturas por aluno a cada abertura.
  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['admin-student-payments', id],
    queryFn: async () => {
      const response = await api.get<StudentPayment[]>(
        `/payments/student/${id}`,
      );
      return response.data;
    },
    enabled: !!id && tab === 'faturas',
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payments', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payment-status', id],
      });
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.byStudent(id),
      });
    }, [queryClient, id]),
  );

  const cancelLesson = useMutation({
    mutationFn: (lessonId: string) =>
      api.patch(`/lessons/${lessonId}`, {
        status: 'CANCELLED',
        cancelReason: 'Cancelada pelo admin',
      }),
    onSuccess: (_, lessonId) => {
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.byStudent(id),
      });
      queryClient.invalidateQueries({ queryKey: adminLessonKeys.schedule() });
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.detail(lessonId),
      });
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível atualizar a aula.');
    },
  });

  const confirmPayment = useMutation({
    mutationFn: (paymentId: string) =>
      api.patch(`/payments/${paymentId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payments', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payment-status', id],
      });
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível confirmar o pagamento.');
    },
  });

  if (loadingStudent || loadingEnrollment) {
    return (
      <DetailScreen title="Detalhes do aluno">
        <View className="py-24 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!student) {
    return (
      <DetailScreen title="Detalhes do aluno">
        <View className="py-24 items-center px-6">
          <Text className="text-sm text-gray-400">Aluno não encontrado</Text>
        </View>
      </DetailScreen>
    );
  }

  // Agrupa as aulas por mês, mais recente primeiro
  const lessonGroups: Record<string, StudentLesson[]> = {};
  (lessons ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    )
    .forEach((lesson) => {
      (lessonGroups[lessonMonthKey(lesson.scheduledAt)] ??= []).push(lesson);
    });
  const lessonMonthKeys = Object.keys(lessonGroups).sort().reverse();

  const matriculaStatus =
    enrollment && paymentStatus
      ? matriculaStatusConfig(paymentStatus.status)
      : undefined;

  const menuItems: ActionMenuItem[] = [
    ...(enrollment
      ? [
          {
            key: 'end',
            label: 'Encerrar matrícula',
            description:
              'Agora, a partir de uma aula ou ao fim de uma fatura. Mantém o histórico',
            icon: UserMinus,
            onPress: () => router.push(`/enrollment-end/${id}`),
          },
        ]
      : []),
    {
      key: 'delete',
      label: 'Excluir aluno e dados',
      description: 'Apaga tudo de forma definitiva',
      icon: Trash2,
      destructive: true,
      onPress: () => router.push(`/student-delete/${id}`),
    },
  ];

  return (
    <>
      <DetailScreen
        title="Detalhes do aluno"
        headerRight={
          <TouchableOpacity
            className="w-9 h-9 rounded-full bg-white items-center justify-center"
            style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mais ações"
          >
            <Ellipsis size={18} color="#1A1A1A" />
          </TouchableOpacity>
        }
      >
        {/* Identificação do aluno */}
        <View className="px-5 pt-5 pb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-xl bg-[#B08D57] items-center justify-center">
              <Music2 size={22} color="#1A1A1A" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className="text-2xl flex-shrink"
                  numberOfLines={1}
                  style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
                >
                  {firstName(student.name)}
                </Text>
                {student.isActive === false && (
                  <Badge label="Inativo" bg="#F3F4F6" color="#6B7280" />
                )}
              </View>
              <Text className="text-sm text-gray-500 mt-0.5">
                {formatInstrument(student.instrument)}
                {student.age ? ` · ${student.age} anos` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Abas */}
        <View className="px-5 mb-4">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </View>

        <View className="px-5 pb-10">
          {tab === 'geral' && (
            <>
              <StudentProfileCard
                student={student}
                onEdit={() => router.push(`/student-edit/${id}`)}
              />
              <EnrollmentCard
                enrollment={enrollment ?? null}
                instrument={student.instrument}
                status={matriculaStatus}
                loadingStatus={loadingPaymentStatus}
                ended={student.isActive === false}
                onEdit={() => router.push(`/enrollment-edit/${id}`)}
              />
            </>
          )}

          {tab === 'aulas' &&
            (loadingLessons ? (
              <Card>
                <ActivityIndicator color="#B08D57" />
              </Card>
            ) : lessonMonthKeys.length === 0 ? (
              <Card>
                <EmptyState text="Nenhuma aula encontrada" />
              </Card>
            ) : (
              lessonMonthKeys.map((monthKey, i) => (
                <LessonMonthGroup
                  key={monthKey}
                  monthKey={monthKey}
                  lessons={lessonGroups[monthKey]}
                  defaultOpen={i === 0}
                  onOpenLesson={(lessonId) =>
                    router.push(`/admin-lesson/${lessonId}`)
                  }
                  onCancelLesson={(lessonId) => cancelLesson.mutate(lessonId)}
                />
              ))
            ))}

          {tab === 'faturas' && (
            <Card>
              {loadingPayments ? (
                <ActivityIndicator color="#B08D57" />
              ) : !payments || payments.length === 0 ? (
                <EmptyState text="Nenhuma fatura encontrada" />
              ) : (
                <PaymentsList
                  payments={payments}
                  onConfirm={(paymentId) => confirmPayment.mutate(paymentId)}
                />
              )}
            </Card>
          )}
        </View>
      </DetailScreen>

      <ActionMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
        title={firstName(student.name)}
      />
    </>
  );
}
