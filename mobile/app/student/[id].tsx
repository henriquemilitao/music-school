import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Music2,
  CalendarClock,
  CreditCard,
  Check,
  X,
  ChevronDown,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';

// ─── Tipos ────────────────────────────────────────────────────────────

type StudentDetail = {
  id: string;
  name: string;
  instrument: string | null;
  birthDate: string | null;
  age: number | null;
  notes: string | null;
  user: { name: string; email: string; phone: string | null };
};

type Enrollment = {
  id: string;
  weekDay: number;
  startTime: string;
  monthlyAmount: string;
  teacher: { user: { name: string } } | null;
} | null;

type Lesson = {
  id: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
};

type Payment = {
  id: string;
  amount: string;
  dueDate: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  referenceMonth: string;
};

type TabKey = 'geral' | 'aulas' | 'faturas';

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

// ─── Helpers de formatação ────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

// Ex: "Sábado, 5 de julho" — dia da semana + dia + mês
function formatWeekdayDate(iso: string) {
  const date = new Date(iso);
  return capitalize(
    date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );
}

function formatMonthKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return capitalize(
    date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
  );
}

function formatMoney(value: string) {
  return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
}

function lessonStatusConfig(status: Lesson['status']) {
  if (status === 'COMPLETED')
    return { label: 'Realizada', bg: '#ECFDF5', text: '#059669' };
  if (status === 'CANCELLED')
    return { label: 'Cancelada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Agendada', bg: '#FFFBEB', text: '#D97706' };
}

function paymentStatusConfig(status: Payment['status']) {
  if (status === 'PAID')
    return { label: 'Paga', bg: '#ECFDF5', text: '#059669' };
  if (status === 'OVERDUE')
    return { label: 'Atrasada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Pendente', bg: '#FFFBEB', text: '#D97706' };
}

// ─── Componentes pequenos ─────────────────────────────────────────────

function Badge({
  label,
  bg,
  color,
}: {
  label: string;
  bg: string;
  color: string;
}) {
  return (
    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: bg }}>
      <Text className="text-[11px] font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function InfoBloco({ label, valor }: { label: string; valor: string }) {
  return (
    <View className="w-1/2 mb-3 pr-2">
      <Text className="text-xs text-gray-400">{label}</Text>
      <Text className="text-sm font-medium mt-0.5">{valor}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="bg-white rounded-2xl p-5 mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View className="items-center py-8">
      <Text className="text-sm text-gray-400">{text}</Text>
    </View>
  );
}

// Uma linha de aula dentro do grupo do mês
function LessonRow({
  lesson,
  isFirst,
  onCancel,
}: {
  lesson: Lesson;
  isFirst: boolean;
  onCancel: () => void;
}) {
  const cfg = lessonStatusConfig(lesson.status);
  return (
    <View
      className="flex-row items-center justify-between py-2.5"
      style={
        !isFirst
          ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }
          : undefined
      }
    >
      <View className="flex-row items-center gap-2.5 flex-1">
        <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
          <CalendarClock size={16} color="#B08D57" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium">
            {formatWeekdayDate(lesson.scheduledAt)}
          </Text>
          {lesson.isMakeup && (
            <Text className="text-[11px] text-[#B08D57] mt-0.5">Reposição</Text>
          )}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
        {lesson.status === 'SCHEDULED' && (
          <TouchableOpacity
            onPress={onCancel}
            className="w-7 h-7 items-center justify-center rounded-full bg-red-50"
          >
            <X size={14} color="#DC2626" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Grupo de aulas de um mês, em formato sanfona
function LessonMonthGroup({
  monthKey,
  lessons,
  defaultOpen,
  onCancelLesson,
}: {
  monthKey: string;
  lessons: Lesson[];
  defaultOpen: boolean;
  onCancelLesson: (lessonId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View
      className="bg-white rounded-2xl overflow-hidden mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-3"
        onPress={() => setOpen(!open)}
      >
        <Text
          className="text-sm font-semibold"
          style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
        >
          {formatMonthLabel(monthKey)}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="rounded-full px-2 py-0.5 bg-[#F5F1EA]">
            <Text className="text-xs font-medium text-gray-500">
              {lessons.length}
            </Text>
          </View>
          <ChevronDown
            size={16}
            color="#9CA3AF"
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>
      {open && (
        <View className="px-4 pb-2">
          {lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              isFirst={i === 0}
              onCancel={() =>
                Alert.alert(
                  'Cancelar aula',
                  'Confirma o cancelamento desta aula?',
                  [
                    { text: 'Voltar', style: 'cancel' },
                    {
                      text: 'Cancelar aula',
                      style: 'destructive',
                      onPress: () => onCancelLesson(lesson.id),
                    },
                  ],
                )
              }
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────

export default function AdminStudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('geral');

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
      const response = await api.get<Enrollment>(`/enrollments/student/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: lessons, isLoading: loadingLessons } = useQuery({
    queryKey: ['admin-student-lessons', id],
    queryFn: async () => {
      const response = await api.get<Lesson[]>(`/lessons/student/${id}`);
      return response.data;
    },
    enabled: !!id && tab === 'aulas',
  });

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['admin-student-payments', id],
    queryFn: async () => {
      const response = await api.get<Payment[]>(`/payments/student/${id}`);
      return response.data;
    },
    enabled: !!id && tab === 'faturas',
  });

  const updateLesson = useMutation({
    mutationFn: async ({
      lessonId,
      status,
      cancelReason,
    }: {
      lessonId: string;
      status: 'CANCELLED';
      cancelReason: string;
    }) => {
      return api.patch(`/lessons/${lessonId}`, { status, cancelReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-student-lessons', id],
      });
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível atualizar a aula.');
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      return api.patch(`/payments/${paymentId}/confirm`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin-student-payments', id],
      });
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível confirmar o pagamento.');
    },
  });

  if (loadingStudent || loadingEnrollment) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (!student) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-sm text-gray-400">Aluno não encontrado</Text>
      </View>
    );
  }

  // Agrupa as aulas por mês, mais recente primeiro
  const lessonGroups: Record<string, Lesson[]> = {};
  (lessons ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    )
    .forEach((lesson) => {
      const key = formatMonthKey(lesson.scheduledAt);
      (lessonGroups[key] ??= []).push(lesson);
    });
  const lessonMonthKeys = Object.keys(lessonGroups).sort().reverse();

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA]">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header no mesmo padrão de lesson/[id] e payment/[id] */}
      <View
        className="flex-row items-center px-4 pt-14 pb-3 bg-[#F5F1EA]"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }}
      >
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-base font-semibold">Detalhes do aluno</Text>
      </View>

      {/* Identificação do aluno */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-12 h-12 rounded-xl bg-[#B08D57] items-center justify-center">
            <Music2 size={22} color="#1A1A1A" />
          </View>
          <View className="flex-1">
            <Text
              className="text-2xl"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              {student.name}
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              {formatInstrument(student.instrument)}
              {student.age ? ` · ${student.age} anos` : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View className="px-5">
        <View
          className="flex-row bg-white rounded-full p-1 mb-4"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
        >
          {(
            [
              { key: 'geral', label: 'Visão geral' },
              { key: 'aulas', label: 'Aulas' },
              { key: 'faturas', label: 'Faturas' },
            ] as { key: TabKey; label: string }[]
          ).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`flex-1 rounded-full py-2 items-center ${
                tab === t.key ? 'bg-[#B08D57]' : ''
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  tab === t.key ? 'text-white' : 'text-gray-500'
                }`}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View className="px-5 pb-10">
        {tab === 'geral' && (
          <>
            <Card>
              <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57] mb-3">
                Dados cadastrais
              </Text>
              <View className="flex-row flex-wrap">
                <InfoBloco
                  label="Instrumento"
                  valor={formatInstrument(student.instrument)}
                />
                <InfoBloco
                  label="Idade"
                  valor={student.age ? `${student.age} anos` : '—'}
                />
                <InfoBloco
                  label="Usuário Responsável"
                  valor={student.user.name}
                />
                <InfoBloco label="Telefone" valor={student.user.phone ?? '—'} />
                <InfoBloco label="E-mail" valor={student.user.email} />
              </View>
            </Card>

            <Card>
              <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57] mb-3">
                Matrícula
              </Text>
              {enrollment ? (
                <View className="flex-row flex-wrap">
                  <InfoBloco
                    label="Professor"
                    valor={enrollment.teacher?.user.name ?? '—'}
                  />
                  <InfoBloco
                    label="Dia da aula"
                    valor={WEEKDAYS[enrollment.weekDay]}
                  />
                  <InfoBloco label="Horário" valor={enrollment.startTime} />
                  <InfoBloco
                    label="Valor mensal"
                    valor={formatMoney(enrollment.monthlyAmount)}
                  />
                </View>
              ) : (
                <EmptyState text="Nenhuma matrícula ativa" />
              )}
            </Card>
          </>
        )}

        {tab === 'aulas' && (
          <>
            {loadingLessons ? (
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
                  onCancelLesson={(lessonId) =>
                    updateLesson.mutate({
                      lessonId,
                      status: 'CANCELLED',
                      cancelReason: 'Cancelada pelo admin',
                    })
                  }
                />
              ))
            )}
          </>
        )}

        {tab === 'faturas' && (
          <Card>
            {loadingPayments ? (
              <ActivityIndicator color="#B08D57" />
            ) : !payments || payments.length === 0 ? (
              <EmptyState text="Nenhuma fatura encontrada" />
            ) : (
              <View className="gap-2.5">
                {payments.map((payment, i) => {
                  const cfg = paymentStatusConfig(payment.status);
                  return (
                    <View
                      key={payment.id}
                      className="py-2.5"
                      style={
                        i > 0
                          ? {
                              borderTopWidth: 1,
                              borderTopColor: 'rgba(0,0,0,0.04)',
                            }
                          : undefined
                      }
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-2.5">
                          <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
                            <CreditCard size={16} color="#B08D57" />
                          </View>
                          <View>
                            <Text className="text-sm font-medium">
                              {formatMoney(payment.amount)}
                            </Text>
                            <Text className="text-[13px] text-gray-500 mt-0.5">
                              Venc. {formatDate(payment.dueDate)}
                            </Text>
                          </View>
                        </View>
                        <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
                      </View>
                      {payment.status !== 'PAID' && (
                        <TouchableOpacity
                          onPress={() =>
                            Alert.alert(
                              'Confirmar pagamento',
                              'Confirma que essa fatura foi paga manualmente?',
                              [
                                { text: 'Voltar', style: 'cancel' },
                                {
                                  text: 'Confirmar',
                                  onPress: () =>
                                    confirmPayment.mutate(payment.id),
                                },
                              ],
                            )
                          }
                          className="flex-row items-center gap-1.5 self-start mt-2.5 bg-[#B08D57] rounded-full px-3.5 py-2"
                        >
                          <Check size={12} color="#fff" />
                          <Text className="text-white text-xs font-medium">
                            Confirmar pagamento
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
