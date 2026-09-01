import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CalendarClock,
  History,
  Receipt,
  ChevronRight,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import { getPaymentUrgency } from '../../lib/paymentUrgency';
import { useLessonStatus } from '../../lib/useLessonStatus';
import { useStudent } from '../../context/StudentContext';
import { dashboardKeys } from '../../lib/queryKeys';
import { lessonStatusConfig } from '../../lib/status';
import { StatusPill } from '../../components/ui/StatusPill';
import { useCallback, useEffect } from 'react';
import { formatCurrency } from '../../lib/paymentFormat';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../../lib/notifications';

// Configura para exibir o alerta mesmo com o app aberto na tela
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type PaymentSummary = {
  id: string;
  referenceMonth: string;
  amount: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
  dueDate: string;
  paidAt: string | null;
};

type DashboardItem = {
  student: { id: string; name: string; age: number; instrument: string };
  nextLesson: {
    scheduledAt: string;
    durationMinutes: number; // NOVO
    teacher: { user: { name: string } } | null;
  } | null;
  lastLesson: {
    scheduledAt: string;
    teacher: { user: { name: string } } | null;
  } | null;
  openPayments: PaymentSummary[];
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFullDate(iso: string) {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  const day = date.getDate();
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${weekday}, ${day} de ${month}`;
}

function formatShortDate(iso: string) {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('pt-BR', { month: 'long' });

  return `${day} de ${month}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const label = date.toLocaleDateString('pt-BR', { month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

const FONT_HEADING = 'PlayfairDisplay_600SemiBold';

function DashboardCard({
  icon: Icon,
  accentBg,
  accentColor,
  label,
  topRight, // 👈 novo
  onPress,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  accentBg: string;
  accentColor: string;
  label: string;
  topRight?: React.ReactNode; // 👈 novo
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-2xl p-3.5 mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={onPress}
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: accentBg }}
      >
        <Icon size={18} color={accentColor} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
            {label}
          </Text>
          {topRight}
        </View>
        {children}
      </View>
      <ChevronRight size={16} color="#D4CFC4" />
    </TouchableOpacity>
  );
}

function NextLessonStatus({
  scheduledAt,
  durationMinutes,
  onFinish,
}: {
  scheduledAt: string | null | undefined;
  durationMinutes: number | null | undefined;
  onFinish: () => void;
}) {
  const status = useLessonStatus(scheduledAt, durationMinutes, onFinish);

  if (!status || status.phase === 'finished') return null;

  if (status.phase === 'recently_finished') {
    return (
      <View className="mt-2">
        <Text
          className="text-[13px] font-bold text-gray-400"
          style={{ fontFamily: FONT_HEADING }}
        >
          ✓ Aula concluída
        </Text>
        <Text className="text-[11px] text-gray-400 mt-0.5">Atualizando...</Text>
      </View>
    );
  }

  if (status.phase === 'in_progress') {
    const minutes = Math.floor((status.secondsRemaining ?? 0) / 60);
    const seconds = (status.secondsRemaining ?? 0) % 60;
    const progressPercent = Math.round((status.progress ?? 0) * 100);

    return (
      <View className="mt-2">
        <Text
          className="text-[13px] font-bold text-[#B08D57]"
          style={{ fontFamily: FONT_HEADING }}
        >
          🎵 Aula em andamento
        </Text>
        <View className="mt-1.5 h-1.5 rounded-full bg-[#F3EADD] overflow-hidden">
          <View
            className="h-full rounded-full bg-[#B08D57]"
            style={{ width: `${progressPercent}%` }}
          />
        </View>
        <Text className="text-[11px] text-gray-400 mt-1">
          Termina em {pad(minutes)}:{pad(seconds)}
        </Text>
      </View>
    );
  }

  // phase === 'upcoming'
  const c = status.countdown!;
  return (
    <View className="flex-row items-center gap-1.5 mt-1.5">
      {[
        { value: c.days, unit: 'd' },
        { value: c.hours, unit: 'h' },
        { value: c.minutes, unit: 'm' },
        { value: c.seconds, unit: 's' },
      ].map((part, i) => (
        <View key={i} className="flex-row items-baseline gap-0.5">
          <Text
            className="text-[13px] font-bold text-[#B08D57]"
            style={{ fontFamily: FONT_HEADING }}
          >
            {pad(part.value)}
          </Text>
          <Text className="text-[10px] text-[#B08D57]/70">{part.unit}</Text>
        </View>
      ))}
    </View>
  );
}

// Nota discreta (mesmo estilo do "+N faturas em aberto, toque para
// ver" que já existia para o próprio aluno) avisando que OUTRO aluno
// vinculado à conta tem fatura pendente. Aparece independente de o
// aluno atual ter ou não fatura própria em aberto — sem isso, um
// responsável com múltiplos filhos podia ver "tudo em dia" aqui
// enquanto outro filho acumulava atrasos sem nenhum sinal visual.
function OtherStudentsPendingNote({
  otherStudents,
  currentStudentHasOpenPayments,
  onPress,
}: {
  otherStudents: DashboardItem[];
  currentStudentHasOpenPayments: boolean;
  onPress: () => void;
}) {
  if (otherStudents.length === 0) return null;

  const verb = currentStudentHasOpenPayments ? 'também tem' : 'tem';

  const label =
    otherStudents.length === 1
      ? `${otherStudents[0].student.name} ${verb} fatura em aberto`
      : `${otherStudents.length} outros alunos ${
          currentStudentHasOpenPayments ? 'também têm' : 'têm'
        } faturas em aberto`;

  return (
    <TouchableOpacity
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Text className="text-[11px] text-gray-400 mt-1.5">
        {label}, toque para ver
      </Text>
    </TouchableOpacity>
  );
}

export default function Index() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedStudentId } = useStudent();

  const { data, isLoading, error } = useQuery({
    queryKey: dashboardKeys.all,
    queryFn: async () => {
      const response = await api.get<DashboardItem[]>('/lessons/my/dashboard');
      return response.data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      // console.log('Dashboard focou, invalidando', selectedStudentId);

      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }, [queryClient]),
  );

  // useEffect(() => {
  //   // Escuta notificações chegando com o app aberto
  //   const subscription = Notifications.addNotificationReceivedListener(
  //     (notification) => {
  //       console.log('NOTIFICAÇÃO CHEGOU NO CELULAR! Data:', notification);
  //     },
  //   );

  //   return () => subscription.remove();
  // }, []);

  // ⬇️ MOVIDO PRA CÁ, antes de qualquer return condicional
  const handleLessonFinish = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  }, [queryClient]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !data || data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar seus dados
        </Text>
      </View>
    );
  }

  const current =
    data.find((d) => d.student.id === selectedStudentId) ?? data[0];
  const { student, nextLesson, lastLesson, openPayments } = current;

  const mostUrgentPayment = openPayments[0] ?? null;
  const extraOpenCount = openPayments.length - 1;

  const paymentUrgency = mostUrgentPayment
    ? getPaymentUrgency(mostUrgentPayment.dueDate, mostUrgentPayment.status)
    : null;

  // Outros alunos (vinculados à mesma conta) que têm fatura em
  // aberto — mostrado independente do aluno atual estar em dia ou
  // não, já que é uma informação sobre OUTRA pessoa, não sobre ele.
  const otherStudentsWithOpenPayments = data.filter(
    (d) => d.student.id !== student.id && d.openPayments.length > 0,
  );

  // "Última aula" só existe quando já ocorreu, então o status visual
  // aqui é sempre o de aula concluída — usa a mesma fonte central em
  // vez do badge verde hardcoded que existia antes.
  const lastLessonConfig = lessonStatusConfig('COMPLETED', false);

  // async function handleTestNotification() {
  //   await Notifications.scheduleNotificationAsync({
  //     content: {
  //       title: 'Notificação da Pianíssima 🎶',
  //       body: 'Teste de notificação local no Dev Client funcionando!',
  //     },
  //     trigger: null, // Dispara instantaneamente
  //   });
  // }

  // async function handleGetPushToken() {
  //   const token = await registerForPushNotificationsAsync();

  //   if (token) {
  //     console.log('PUSH TOKEN GERADO:', token);
  //     // Pega o token nativo do Firebase (FCM)
  //     const deviceToken = await Notifications.getDevicePushTokenAsync();
  //     console.log('FCM TOKEN NATIVO:', deviceToken.data);
  //     Alert.alert('Token Gerado com Sucesso!', token);
  //   } else {
  //     Alert.alert('Erro', 'Não foi possível gerar o token. Verifique os logs.');
  //   }
  // }
  return (
    <View className="flex-1 bg-[#F5F1EA]">
      <ScrollView className="flex-1 px-4 pt-4">
        <Text
          className="text-3xl text-[#1A1A1A] mb-1"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {student.name}
        </Text>
        <Text className="text-gray-500 mb-5">
          {formatInstrument(student.instrument)} · Acompanhe suas aulas
        </Text>

        <DashboardCard
          icon={CalendarClock}
          accentBg="#F3EADD"
          accentColor="#B08D57"
          label="Próxima aula"
          onPress={() => router.push('/lessons')}
        >
          {nextLesson ? (
            <>
              <Text
                className="text-[15px] font-semibold"
                style={{ fontFamily: FONT_HEADING }}
              >
                {capitalize(formatFullDate(nextLesson.scheduledAt))}
              </Text>
              <Text className="text-[13px] text-gray-500 mt-0.5">
                {formatTime(nextLesson.scheduledAt)}
                {nextLesson.teacher ? ` · ${nextLesson.teacher.user.name}` : ''}
              </Text>
            </>
          ) : (
            <Text className="text-[13px] text-gray-400">
              Nenhuma aula agendada
            </Text>
          )}
          <NextLessonStatus
            scheduledAt={nextLesson?.scheduledAt}
            durationMinutes={nextLesson?.durationMinutes}
            onFinish={handleLessonFinish}
          />
        </DashboardCard>

        <DashboardCard
          icon={History}
          accentBg="#ECFDF5"
          accentColor="#059669"
          label="Última aula"
          onPress={() => router.push('/lessons')}
          topRight={lastLesson ? <StatusPill {...lastLessonConfig} /> : null}
        >
          {lastLesson ? (
            <>
              <Text
                className="text-[15px] font-semibold"
                style={{ fontFamily: FONT_HEADING }}
              >
                {capitalize(formatFullDate(lastLesson.scheduledAt))}
              </Text>
              <Text className="text-[13px] text-gray-500 mt-0.5">
                {lastLesson.teacher ? `${lastLesson.teacher.user.name} · ` : ''}
                {formatInstrument(student.instrument)}
              </Text>
            </>
          ) : (
            <Text className="text-[13px] text-gray-400">
              Sem aulas registradas
            </Text>
          )}
        </DashboardCard>

        <DashboardCard
          icon={Receipt}
          accentBg="#1A1A1A"
          accentColor="#F5F1EA"
          label={`Fatura${mostUrgentPayment?.referenceMonth ? ` · ${formatReferenceMonth(mostUrgentPayment.referenceMonth)}` : ''}`}
          onPress={() => router.push('/payments')}
          topRight={
            mostUrgentPayment?.status === 'OVERDUE' && paymentUrgency ? (
              <StatusPill
                label={paymentUrgency.label}
                colorText={paymentUrgency.colorText}
                colorBg={paymentUrgency.colorBg}
              />
            ) : mostUrgentPayment?.status === 'PENDING' ? (
              <StatusPill
                label="Pendente"
                colorText="#D97706"
                colorBg="#FFFBEB"
              />
            ) : null
          }
        >
          {mostUrgentPayment ? (
            <>
              <Text
                className="text-[15px] font-semibold"
                style={{ fontFamily: FONT_HEADING }}
              >
                R$ {formatCurrency(mostUrgentPayment.amount)}
              </Text>
              <Text className="text-[13px] text-gray-500 mt-0.5">
                Vence {formatShortDate(mostUrgentPayment.dueDate)}
              </Text>

              {extraOpenCount > 0 && (
                <Text className="text-[11px] text-gray-400 mt-1.5">
                  + {extraOpenCount}{' '}
                  {extraOpenCount === 1
                    ? 'fatura em aberto'
                    : 'faturas em aberto'}
                  , toque para ver
                </Text>
              )}
              <OtherStudentsPendingNote
                otherStudents={otherStudentsWithOpenPayments}
                currentStudentHasOpenPayments={true}
                onPress={() => router.push('/payments')}
              />
            </>
          ) : (
            <>
              <Text className="text-[13px] text-green-600">
                Pagamentos em dia
              </Text>
              <OtherStudentsPendingNote
                otherStudents={otherStudentsWithOpenPayments}
                currentStudentHasOpenPayments={false}
                onPress={() => router.push('/payments')}
              />
            </>
          )}
        </DashboardCard>
        {/* 
        <TouchableOpacity
          className="bg-[#B08D57] p-3.5 rounded-2xl items-center mb-4"
          onPress={handleTestNotification}
        >
          <Text className="text-white font-bold">
            Disparar Notificação Teste
          </Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity
          className="bg-black p-3.5 rounded-2xl items-center mb-4"
          onPress={handleGetPushToken}
        >
          <Text className="text-white font-bold">Obter Expo Push Token</Text>
        </TouchableOpacity> */}

        <Text className="text-center text-gray-400 text-xs mt-4 mb-8">
          Pianíssima · Aqui tem música
        </Text>
      </ScrollView>
    </View>
  );
}
