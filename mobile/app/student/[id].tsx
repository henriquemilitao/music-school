import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Ellipsis,
  Music2,
  Pencil,
  Trash2,
  UserMinus,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import { firstName } from '../../lib/name';
import { alertAsync, confirmAsync } from '../../lib/dialog';
import {
  bulkDeleteLessons,
  useRefreshLessons,
  useStudentLessons,
} from '../../lib/lessonAdmin';
import { adminLessonKeys } from '../../lib/queryKeys';
import { usePaymentActions, useStudentPayments } from '../../lib/adminPayments';
import { useSelection } from '../../lib/useSelection';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
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
import { LessonsTab } from '../../components/student/detail/LessonsTab';
import { PaymentsList } from '../../components/student/detail/PaymentsList';
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

// Painel de uma aba: só entra na tela depois da primeira visita e, depois
// disso, apenas fica escondido quando outra aba está ativa — assim voltar a
// ela não refaz a tela inteira.
function TabPanel({
  active,
  visited = true,
  children,
}: {
  active: boolean;
  visited?: boolean;
  children: ReactNode;
}) {
  if (!active && !visited) return null;
  return (
    <View style={active ? undefined : { display: 'none' }}>{children}</View>
  );
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
  // Abas já abertas ficam montadas (só escondidas): voltar a elas é instantâneo
  const [visitedTabs, setVisitedTabs] = useState<ReadonlySet<TabKey>>(
    () => new Set<TabKey>(['geral']),
  );
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

  // Aulas e faturas começam a carregar assim que os dados básicos chegam,
  // enquanto a pessoa ainda olha a visão geral — ao abrir a aba, já estão aí.
  const baseReady = !!student && !loadingEnrollment;
  const lessonsQuery = useStudentLessons(id, baseReady);
  const lessons = lessonsQuery.data;

  const selection = useSelection();
  const { clear: clearSelection } = selection;
  const openLesson = useCallback(
    (lessonId: string) => router.push(`/admin-lesson/${lessonId}`),
    [router],
  );
  const refreshLessons = useRefreshLessons();
  // Ao voltar da edição em lote, o modo de seleção termina
  const endSelectionOnFocus = useRef(false);

  const paymentsQuery = useStudentPayments(id, baseReady);
  const payments = paymentsQuery.data;
  const paymentActions = usePaymentActions();

  useFocusEffect(
    useCallback(() => {
      if (endSelectionOnFocus.current) {
        endSelectionOnFocus.current = false;
        clearSelection();
      }
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payments', id],
      });
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payment-status', id],
      });
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.byStudent(id),
      });
    }, [queryClient, id, clearSelection]),
  );

  const deleteSelected = useMutation({
    mutationFn: () => bulkDeleteLessons([...selection.ids]),
    onSuccess: () => {
      refreshLessons(id, [...selection.ids]);
      selection.clear();
    },
    onError: () => {
      void alertAsync({
        title: 'Erro',
        message: 'Não foi possível excluir as aulas.',
        tone: 'error',
      });
    },
  });

  // Android: o voltar do sistema sai do modo de seleção em vez de fechar a tela
  useEffect(() => {
    if (!selection.selecting) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        clearSelection();
        return true;
      },
    );
    return () => subscription.remove();
  }, [selection.selecting, clearSelection]);

  async function handleDeleteSelected() {
    const count = selection.ids.size;
    const ok = await confirmAsync({
      title: count === 1 ? 'Excluir 1 aula?' : `Excluir ${count} aulas?`,
      message:
        'As aulas somem do histórico do aluno, junto com as anotações. Não dá para desfazer.\n\nSe só quer avisar que a aula não vai acontecer, prefira cancelar ou mudar a data.',
      confirmText: 'Excluir',
      destructive: true,
    });
    if (ok) deleteSelected.mutate();
  }

  function handleEditSelected() {
    endSelectionOnFocus.current = true;
    // Uma só: tela completa da aula. Várias: edição em lote.
    if (selection.ids.size === 1) {
      router.push(`/lesson-edit/${[...selection.ids][0]}`);
      return;
    }
    router.push({
      pathname: '/lessons-edit',
      params: { studentId: id, ids: [...selection.ids].join(',') },
    });
  }

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

  const allLessonIds = (lessons ?? []).map((lesson) => lesson.id);
  const selectedCount = selection.ids.size;
  const allSelected =
    allLessonIds.length > 0 && selectedCount === allLessonIds.length;

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
        title={
          selection.selecting
            ? selectedCount === 0
              ? 'Selecionar aulas'
              : selectedCount === 1
                ? '1 aula selecionada'
                : `${selectedCount} aulas selecionadas`
            : 'Detalhes do aluno'
        }
        onBack={selection.selecting ? selection.clear : undefined}
        headerRight={
          selection.selecting ? (
            <TouchableOpacity
              className="rounded-full bg-white px-3.5 h-9 items-center justify-center"
              style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
              onPress={() =>
                allSelected
                  ? selection.unselectAll()
                  : selection.selectAll(allLessonIds)
              }
              accessibilityRole="button"
            >
              <Text className="text-[13px] font-semibold">
                {allSelected ? 'Limpar' : 'Selecionar todas'}
              </Text>
            </TouchableOpacity>
          ) : (
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
          )
        }
        footer={
          selection.selecting && tab === 'aulas' ? (
            <ActionFooter>
              <Button
                label={
                  selectedCount === 1
                    ? 'Editar 1 aula'
                    : `Editar ${selectedCount} aulas`
                }
                icon={Pencil}
                onPress={handleEditSelected}
                disabled={selectedCount === 0}
              />
              <Button
                label="Excluir"
                variant="danger"
                icon={Trash2}
                grow={false}
                onPress={() => void handleDeleteSelected()}
                disabled={selectedCount === 0}
                loading={deleteSelected.isPending}
              />
            </ActionFooter>
          ) : undefined
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
          <SegmentedControl
            options={TABS}
            value={tab}
            onChange={(next) => {
              if (next !== 'aulas') clearSelection();
              setTab(next);
              setVisitedTabs((current) =>
                current.has(next) ? current : new Set(current).add(next),
              );
            }}
          />
        </View>

        <View className="px-5 pb-10">
          <TabPanel active={tab === 'geral'}>
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
          </TabPanel>

          <TabPanel active={tab === 'aulas'} visited={visitedTabs.has('aulas')}>
            <LessonsTab
              lessons={lessons}
              loading={lessonsQuery.isLoading}
              error={lessonsQuery.isError}
              onRetry={() => void lessonsQuery.refetch()}
              studentInstrument={student.instrument}
              selection={selection}
              onOpenLesson={openLesson}
              onNewLesson={() => router.push(`/lesson-new/${id}`)}
            />
          </TabPanel>

          <TabPanel
            active={tab === 'faturas'}
            visited={visitedTabs.has('faturas')}
          >
            {paymentsQuery.isLoading ? (
              <ActivityIndicator color="#B08D57" />
            ) : paymentsQuery.isError ? (
              <ErrorRetry
                onRetry={() => void paymentsQuery.refetch()}
                retrying={paymentsQuery.isRefetching}
              />
            ) : !payments || payments.length === 0 ? (
              <Card>
                <EmptyState text="Nenhuma fatura encontrada" />
              </Card>
            ) : (
              <PaymentsList
                payments={payments}
                busyId={paymentActions.busyId}
                onOpen={(paymentId) =>
                  router.push(`/admin-payment/${paymentId}`)
                }
                onConfirm={(payment) => void paymentActions.confirm(payment)}
              />
            )}
          </TabPanel>
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
