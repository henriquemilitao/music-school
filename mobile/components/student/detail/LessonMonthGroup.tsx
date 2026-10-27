import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { confirmAsync } from '../../../lib/confirm';
import { NotesIndicator } from '../../lesson/NotesIndicator';
import { Badge } from './Badge';

export type StudentLesson = {
  id: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
  notes: string | null;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Ex: "Sábado, 5 de julho"
function formatWeekdayDate(iso: string) {
  return capitalize(
    new Date(iso).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  );
}

export function lessonMonthKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return capitalize(
    new Date(year, month - 1, 1).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    }),
  );
}

function statusConfig(status: StudentLesson['status']) {
  if (status === 'COMPLETED')
    return { label: 'Realizada', bg: '#ECFDF5', text: '#059669' };
  if (status === 'CANCELLED')
    return { label: 'Cancelada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Agendada', bg: '#FFFBEB', text: '#D97706' };
}

// Uma linha de aula dentro do grupo do mês — toque abre o detalhe da aula
function LessonRow({
  lesson,
  isFirst,
  onOpen,
  onCancel,
}: {
  lesson: StudentLesson;
  isFirst: boolean;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const cfg = statusConfig(lesson.status);
  return (
    <TouchableOpacity
      onPress={onOpen}
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
          {lesson.notes && <NotesIndicator />}
        </View>
      </View>
      <View className="flex-row items-center gap-2">
        <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
        {lesson.status === 'SCHEDULED' && (
          <TouchableOpacity
            onPress={onCancel}
            className="w-7 h-7 items-center justify-center rounded-full bg-red-50"
            accessibilityLabel="Cancelar aula"
          >
            <X size={14} color="#DC2626" />
          </TouchableOpacity>
        )}
        <ChevronRight size={16} color="#D4CFC4" />
      </View>
    </TouchableOpacity>
  );
}

// Grupo de aulas de um mês, em formato sanfona
export function LessonMonthGroup({
  monthKey,
  lessons,
  defaultOpen,
  onOpenLesson,
  onCancelLesson,
}: {
  monthKey: string;
  lessons: StudentLesson[];
  defaultOpen: boolean;
  onOpenLesson: (lessonId: string) => void;
  onCancelLesson: (lessonId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  async function handleCancel(lessonId: string) {
    const ok = await confirmAsync({
      title: 'Cancelar aula',
      message: 'Confirma o cancelamento desta aula?',
      confirmText: 'Cancelar aula',
      cancelText: 'Voltar',
      destructive: true,
    });
    if (ok) onCancelLesson(lessonId);
  }

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
              onOpen={() => onOpenLesson(lesson.id)}
              onCancel={() => void handleCancel(lesson.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
