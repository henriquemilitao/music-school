import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { api } from '../../lib/api';
import { router } from 'expo-router';
import { formatInstrument } from '../../lib/instrument';
import { useStudent } from '../../context/StudentContext';
import { lessonStatusConfig } from '../../lib/status';
import { StatusPill } from '../../components/ui/StatusPill';

type Lesson = {
  id: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
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
    }),
  );
}

function formatShortDate(iso: string) {
  const date = new Date(iso);
  return capitalize(
    date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' }),
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
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

function UpcomingLesson({ lesson }: { lesson: Lesson }) {
  const date = new Date(lesson.scheduledAt);
  const month = date
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
  const day = date.getDate();

  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 bg-white rounded-2xl p-3.5 mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={() => router.push(`/lesson/${lesson.id}`)}
    >
      <View
        className="w-14 h-14 rounded-xl items-center justify-center bg-[#F5F1EA]"
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <Text className="text-[9px] font-bold uppercase text-[#B08D57]">
          {month}
        </Text>
        <Text
          className="text-xl leading-tight" // subiu de text-xl pra text-2xl
          style={{ fontFamily: 'PlayfairDisplay_700Bold', color: '#1a1a1a' }} // cor explícita, escura
        >
          {day}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium">
          {formatFullDate(lesson.scheduledAt)}
        </Text>
        <Text className="text-[13px] text-gray-500 mt-0.5">
          {formatTime(lesson.scheduledAt)}
          {lesson.teacher ? ` · ${lesson.teacher.user.name}` : ''}
        </Text>
      </View>
      {formatInstrument(lesson.student.instrument) && (
        <View className="rounded-full px-2.5 py-1 bg-[#F3EADD]">
          <Text className="text-xs font-medium text-[#B08D57]">
            {formatInstrument(lesson.student.instrument)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function HistoryRow({ lesson }: { lesson: Lesson }) {
  return (
    <TouchableOpacity
      className="flex-row items-center gap-3 bg-white rounded-2xl p-3.5 mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={() => router.push(`/lesson/${lesson.id}`)}
    >
      <View className="flex-1">
        <Text className="text-sm font-medium">
          {formatShortDate(lesson.scheduledAt)}
        </Text>
        <Text className="text-[13px] text-gray-500 mt-0.5">
          {formatTime(lesson.scheduledAt)}
          {lesson.teacher ? ` · ${lesson.teacher.user.name}` : ''}
        </Text>
      </View>
      <View style={{ flexShrink: 0 }}>
        <StatusPill {...lessonStatusConfig(lesson.status, lesson.isMakeup)} />
      </View>
    </TouchableOpacity>
  );
}

function MonthGroup({
  monthKey,
  lessons,
}: {
  monthKey: string;
  lessons: Lesson[];
}) {
  const [open, setOpen] = useState(true);

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
            <View
              key={lesson.id}
              style={
                i > 0
                  ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }
                  : undefined
              }
            >
              <HistoryRow lesson={lesson} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View
      className="bg-white rounded-2xl p-8 items-center"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Text className="text-sm text-gray-400">{text}</Text>
    </View>
  );
}

export default function Lessons() {
  const [tab, setTab] = useState<'proximas' | 'historico'>('proximas');

  const { selectedStudentId, selectedStudent } = useStudent();
  const { data, isLoading, error } = useQuery({
    queryKey: ['lessons', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const response = await api.get<Lesson[]>('/lessons/my', {
        params: { studentId: selectedStudentId },
      });
      return response.data;
    },
    enabled: !!selectedStudentId,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar suas aulas
        </Text>
      </View>
    );
  }

  const now = new Date();
  const proximas = data
    .filter((l) => l.status === 'SCHEDULED' && new Date(l.scheduledAt) >= now)
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  const historico = data
    .filter((l) => l.status !== 'SCHEDULED' || new Date(l.scheduledAt) < now)
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );

  const groups: Record<string, Lesson[]> = {};
  historico.forEach((lesson) => {
    const key = formatMonthKey(lesson.scheduledAt);
    (groups[key] ??= []).push(lesson);
  });
  const groupKeys = Object.keys(groups).sort().reverse();

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA] px-5 pt-5">
      <Text
        className="text-2xl mb-1"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        Aulas
      </Text>
      {selectedStudent && (
        <Text className="text-gray-500 text-sm mb-4">
          {selectedStudent.name} ·{' '}
          {formatInstrument(selectedStudent.instrument)}
        </Text>
      )}

      <View
        className="flex-row bg-white rounded-full p-1 mb-4"
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <TouchableOpacity
          className={`flex-1 rounded-full py-2 items-center ${tab === 'proximas' ? 'bg-[#B08D57]' : ''}`}
          onPress={() => setTab('proximas')}
        >
          <Text
            className={`text-sm font-medium ${tab === 'proximas' ? 'text-white' : 'text-gray-500'}`}
          >
            Próximas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 rounded-full py-2 items-center ${tab === 'historico' ? 'bg-[#B08D57]' : ''}`}
          onPress={() => setTab('historico')}
        >
          <Text
            className={`text-sm font-medium ${tab === 'historico' ? 'text-white' : 'text-gray-500'}`}
          >
            Histórico
          </Text>
        </TouchableOpacity>
      </View>

      <View className="pb-10">
        {tab === 'proximas' ? (
          proximas.length === 0 ? (
            <EmptyState text="Nenhuma aula agendada" />
          ) : (
            proximas.map((lesson) => (
              <UpcomingLesson key={lesson.id} lesson={lesson} />
            ))
          )
        ) : groupKeys.length === 0 ? (
          <EmptyState text="Sem histórico de aulas" />
        ) : (
          groupKeys.map((key) => (
            <MonthGroup key={key} monthKey={key} lessons={groups[key]} />
          ))
        )}
      </View>
    </ScrollView>
  );
}
