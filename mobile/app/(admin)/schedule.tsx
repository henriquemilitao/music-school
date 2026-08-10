import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';

// ─── Tipos ────────────────────────────────────────────────────────────

type LessonOfDay = {
  id: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
  student: { id: string; name: string; instrument: string | null };
  teacher: { user: { name: string } } | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatHeaderDate(date: Date) {
  return capitalize(
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
  );
}

function formatWeekday(date: Date) {
  return capitalize(date.toLocaleDateString('pt-BR', { weekday: 'long' }));
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isToday(date: Date) {
  const today = new Date();
  return toDateKey(date) === toDateKey(today);
}

function lessonStatusConfig(status: LessonOfDay['status']) {
  if (status === 'COMPLETED')
    return { label: 'Realizada', bg: '#ECFDF5', text: '#059669' };
  if (status === 'CANCELLED')
    return { label: 'Cancelada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Agendada', bg: '#FFFBEB', text: '#D97706' };
}

// ─── Componentes ─────────────────────────────────────────────────────

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

function LessonCard({
  lesson,
  router,
}: {
  lesson: LessonOfDay;
  router: ReturnType<typeof useRouter>;
}) {
  const cfg = lessonStatusConfig(lesson.status);
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-2xl p-3.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={() => router.push(`/student/${lesson.student.id}`)}
    >
      <View className="items-center pr-3.5 mr-3.5" style={{ minWidth: 56 }}>
        <Text
          className="text-lg leading-tight"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {formatTime(lesson.scheduledAt)}
        </Text>
      </View>
      <View
        style={{
          width: 1,
          alignSelf: 'stretch',
          backgroundColor: 'rgba(0,0,0,0.06)',
          marginRight: 14,
        }}
      />
      <View className="flex-1">
        <Text className="text-sm font-medium">{lesson.student.name}</Text>
        <Text className="text-[13px] text-gray-500 mt-0.5">
          {formatInstrument(lesson.student.instrument)}
          {lesson.teacher ? ` · Prof. ${lesson.teacher.user.name}` : ''}
        </Text>
        {lesson.isMakeup && (
          <Text className="text-[11px] text-[#B08D57] mt-0.5">Reposição</Text>
        )}
      </View>
      <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View
      className="items-center py-14 bg-white rounded-2xl"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        borderStyle: 'dashed',
      }}
    >
      <CalendarDays size={28} color="#D4CFC4" />
      <Text className="text-sm text-gray-400 mt-2.5">
        Nenhuma aula agendada para este dia
      </Text>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────

export default function AdminSchedule() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  const dateKey = toDateKey(selectedDate);

  const { data: lessons, isLoading } = useQuery({
    queryKey: ['admin-schedule', dateKey],
    queryFn: async () => {
      const response = await api.get<LessonOfDay[]>('/lessons/day', {
        params: { date: dateKey },
      });
      return response.data;
    },
  });

  const sortedLessons = (lessons ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA] px-5 pt-5">
      <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57] mb-1">
        Gestão
      </Text>
      <Text
        className="text-2xl mb-4"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        Agenda do dia
      </Text>

      {/* Seletor de dia */}
      <View
        className="flex-row items-center justify-between bg-white rounded-2xl px-3 py-2.5 mb-4"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        }}
      >
        <TouchableOpacity
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}
          onPress={() => setSelectedDate((d) => addDays(d, -1))}
        >
          <ChevronLeft size={18} color="#4B5563" />
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center flex-1"
          onPress={() => setPickerOpen(true)}
        >
          <View className="flex-row items-center gap-1.5">
            <Text
              className="text-base font-semibold"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              {formatHeaderDate(selectedDate)}
            </Text>
            {isToday(selectedDate) && (
              <View className="rounded-full px-2 py-0.5 bg-[#F3EADD]">
                <Text className="text-[10px] font-bold text-[#B08D57]">
                  HOJE
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-gray-400 mt-0.5">
            {formatWeekday(selectedDate)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-9 h-9 rounded-xl items-center justify-center"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}
          onPress={() => setSelectedDate((d) => addDays(d, 1))}
        >
          <ChevronRight size={18} color="#4B5563" />
        </TouchableOpacity>
      </View>

      {/* Android: 'calendar' já abre a grade de mês nativa direto */}
      {pickerOpen && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="calendar"
          onChange={(_, date) => {
            setPickerOpen(false);
            if (date) setSelectedDate(date);
          }}
        />
      )}

      {/* iOS: calendário mensal completo, dentro de um modal próprio
          pra garantir que apareça inteiro e não fique escondido */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={pickerOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerOpen(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.35)',
              justifyContent: 'center',
              paddingHorizontal: 20,
            }}
            activeOpacity={1}
            onPress={() => setPickerOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View
                className="bg-white rounded-2xl p-4"
                style={{
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="inline"
                  onChange={(_, date) => {
                    if (date) setSelectedDate(date);
                  }}
                  accentColor="#B08D57"
                />
                <TouchableOpacity
                  className="mt-2 self-center rounded-full bg-[#1A1A1A] px-5 py-2.5"
                  onPress={() => setPickerOpen(false)}
                >
                  <Text className="text-white text-sm font-medium">
                    Confirmar
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Contagem do dia */}
      {!isLoading && (
        <Text className="text-xs text-gray-400 mb-3 px-1">
          {sortedLessons.length}{' '}
          {sortedLessons.length === 1 ? 'aula agendada' : 'aulas agendadas'}
        </Text>
      )}

      {/* Lista de aulas */}
      <View className="gap-2.5 pb-10">
        {isLoading ? (
          <ActivityIndicator color="#B08D57" style={{ marginTop: 24 }} />
        ) : sortedLessons.length === 0 ? (
          <EmptyState />
        ) : (
          sortedLessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} router={router} />
          ))
        )}
      </View>
    </ScrollView>
  );
}
