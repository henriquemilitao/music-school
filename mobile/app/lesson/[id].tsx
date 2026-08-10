import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { ArrowLeft, Clock, User, Music, StickyNote } from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';

type Lesson = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
  notes: string | null;
  cancelReason: string | null;
  teacher: { user: { name: string } } | null;
  student: { name: string; instrument: string | null };
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatFullDate(iso: string) {
  const date = new Date(iso);
  return capitalize(
    date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function addMinutes(iso: string, minutes: number) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function statusConfig(lesson: Lesson) {
  if (lesson.isMakeup)
    return { label: 'Reposição', bg: 'bg-purple-50', text: 'text-purple-700' };
  if (lesson.status === 'COMPLETED')
    return { label: 'Realizada', bg: 'bg-green-50', text: 'text-green-700' };
  if (lesson.status === 'CANCELLED')
    return { label: 'Falta', bg: 'bg-red-50', text: 'text-red-700' };
  return { label: 'Agendada', bg: 'bg-yellow-50', text: 'text-yellow-700' };
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
        <Icon size={17} color="#B08D57" />
      </View>
      <View>
        <Text className="text-xs text-gray-400">{label}</Text>
        <Text className="text-sm font-medium">{value}</Text>
      </View>
    </View>
  );
}

export default function LessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: lesson,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lesson', id],
    queryFn: async () => {
      const response = await api.get<Lesson>(`/lessons/my/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar essa aula
        </Text>
      </View>
    );
  }

  const config = statusConfig(lesson);

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA]">
      <Stack.Screen options={{ headerShown: false }} />

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
        <Text className="text-base font-semibold">Detalhes da aula</Text>
      </View>

      <View className="px-5 pt-5 pb-6">
        <Text
          className="text-2xl"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {formatFullDate(lesson.scheduledAt)}
        </Text>
        <View
          className={`self-start rounded-full px-2.5 py-1 mt-2 ${config.bg}`}
        >
          <Text className={`text-[11px] font-bold ${config.text}`}>
            {config.label}
          </Text>
        </View>
      </View>

      <View className="px-5 gap-4 pb-10">
        <View
          className="bg-white rounded-2xl p-5 gap-4"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <InfoRow
            icon={Clock}
            label="Horário"
            value={`${formatTime(lesson.scheduledAt)} às ${formatTime(
              addMinutes(lesson.scheduledAt, lesson.durationMinutes),
            )}`}
          />
          {lesson.teacher && (
            <InfoRow
              icon={User}
              label="Professor"
              value={lesson.teacher.user.name}
            />
          )}
          {lesson.student.instrument && (
            <InfoRow
              icon={Music}
              label="Instrumento"
              value={formatInstrument(lesson.student.instrument)}
            />
          )}
        </View>

        {lesson.status === 'CANCELLED' && lesson.cancelReason && (
          <View
            className="bg-white rounded-2xl p-5"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <StickyNote size={18} color="#DC2626" />
              <Text className="text-sm font-bold">Motivo da falta</Text>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              {lesson.cancelReason}
            </Text>
          </View>
        )}

        {lesson.notes && (
          <View
            className="bg-white rounded-2xl p-5"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <StickyNote size={18} color="#B08D57" />
              <Text className="text-sm font-bold">Observações</Text>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              {lesson.notes}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
