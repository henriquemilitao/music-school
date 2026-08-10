import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  History,
  Receipt,
  ChevronRight,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import { getPaymentUrgency } from '../../lib/paymentUrgency';
import { useCountdown } from '../../lib/useCountdown';
import { useStudent } from '../../context/StudentContext';

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
    teacher: { user: { name: string } } | null;
  } | null;
  lastLesson: {
    scheduledAt: string;
    teacher: { user: { name: string } } | null;
  } | null;
  // Todas as faturas em aberto (PENDING/OVERDUE) do aluno, da mais
  // antiga (mais urgente) pra mais nova. Vazio = nada pendente.
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
  return `${date.getDate()} de ${date.toLocaleDateString('pt-BR', { month: 'long' })}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "2026-08" -> "Agosto"
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
  onPress,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  accentBg: string;
  accentColor: string;
  label: string;
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
        <Text className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-0.5">
          {label}
        </Text>
        {children}
      </View>
      <ChevronRight size={16} color="#D4CFC4" />
    </TouchableOpacity>
  );
}

// Countdown ao vivo (dias:horas:min:seg), exclusivo da próxima aula.
function NextLessonCountdown({ scheduledAt }: { scheduledAt: string }) {
  const countdown = useCountdown(scheduledAt);

  if (!countdown || countdown.isPast) return null;

  return (
    <View className="flex-row items-center gap-1.5 mt-1.5">
      {[
        { value: countdown.days, unit: 'd' },
        { value: countdown.hours, unit: 'h' },
        { value: countdown.minutes, unit: 'm' },
        { value: countdown.seconds, unit: 's' },
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

export default function Index() {
  const router = useRouter();

  const { selectedStudentId } = useStudent(); // <-- substitui o useState
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardItem[]>('/lessons/my/dashboard');
      return response.data;
    },
  });

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

  // A mais urgente já vem em primeiro (o backend ordena por dueDate asc)
  const mostUrgentPayment = openPayments[0] ?? null;
  const extraOpenCount = openPayments.length - 1;

  const paymentUrgency = mostUrgentPayment
    ? getPaymentUrgency(mostUrgentPayment.dueDate, mostUrgentPayment.status)
    : null;

  return (
    <View className="flex-1 bg-[#F5F1EA]">
      {/* <DashboardHeader
        students={data.map((d) => d.student)}
        selectedId={student.id}
        onSelect={setSelectedId}
      /> */}

      <ScrollView className="flex-1 px-4 pt-2">
        <Text className="text-xs tracking-[3px] text-[#B08D57] font-bold mb-1">
          AQUI TEM MÚSICA
        </Text>
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
              <NextLessonCountdown scheduledAt={nextLesson.scheduledAt} />
            </>
          ) : (
            <Text className="text-[13px] text-gray-400">
              Nenhuma aula agendada
            </Text>
          )}
        </DashboardCard>

        <DashboardCard
          icon={History}
          accentBg="#ECFDF5"
          accentColor="#059669"
          label="Última aula"
          onPress={() => router.push('/lessons')}
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
              <View className="self-start bg-green-50 rounded-full px-2.5 py-1 mt-1.5">
                <Text className="text-green-600 text-[11px] font-bold">
                  ✓ Realizada
                </Text>
              </View>
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
        >
          {mostUrgentPayment ? (
            <>
              <Text
                className="text-[15px] font-semibold"
                style={{ fontFamily: FONT_HEADING }}
              >
                R$ {mostUrgentPayment.amount}
              </Text>
              <Text className="text-[13px] text-gray-500 mt-0.5">
                Vence {formatShortDate(mostUrgentPayment.dueDate)}
              </Text>
              {paymentUrgency && (
                <View
                  className="self-start rounded-full px-2.5 py-1 mt-1.5"
                  style={{ backgroundColor: paymentUrgency.colorBg }}
                >
                  <Text
                    className="text-[11px] font-bold"
                    style={{ color: paymentUrgency.colorText }}
                  >
                    {paymentUrgency.label}
                  </Text>
                </View>
              )}
              {extraOpenCount > 0 && (
                <Text className="text-[11px] text-gray-400 mt-1.5">
                  + {extraOpenCount}{' '}
                  {extraOpenCount === 1
                    ? 'fatura em aberto'
                    : 'faturas em aberto'}
                  , toque para ver
                </Text>
              )}
            </>
          ) : (
            <Text className="text-[13px] text-green-600">
              Sem fatura disponível
            </Text>
          )}
        </DashboardCard>

        <Text className="text-center text-gray-400 text-xs mt-4 mb-8">
          Pianíssima · Aqui tem música
        </Text>
      </ScrollView>
    </View>
  );
}
