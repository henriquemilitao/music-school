import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { StudentLesson } from '../../../lib/lessonTypes';
import { LessonRow, SelectionCheckbox } from './LessonRow';

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

type LessonMonthGroupProps = {
  monthKey: string;
  lessons: StudentLesson[];
  studentInstrument: string | null;
  defaultOpen: boolean;
  // Modo de seleção
  selecting: boolean;
  selectedIds: ReadonlySet<string>;
  onOpenLesson: (lessonId: string) => void;
  onToggleLesson: (lessonId: string) => void;
  onLongPressLesson: (lessonId: string) => void;
  // Marca/desmarca todas as aulas do mês de uma vez
  onToggleMonth: (lessonIds: string[], selected: boolean) => void;
};

// Grupo de aulas de um mês, em formato sanfona. No modo de seleção o
// cabeçalho ganha uma caixa que marca o mês inteiro.
export function LessonMonthGroup({
  monthKey,
  lessons,
  studentInstrument,
  defaultOpen,
  selecting,
  selectedIds,
  onOpenLesson,
  onToggleLesson,
  onLongPressLesson,
  onToggleMonth,
}: LessonMonthGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  const ids = lessons.map((lesson) => lesson.id);
  const selectedCount = ids.filter((id) => selectedIds.has(id)).length;
  const allSelected = selectedCount === ids.length;

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
      <View className="flex-row items-center">
        {selecting && (
          <TouchableOpacity
            onPress={() => onToggleMonth(ids, !allSelected)}
            className="pl-4 py-3"
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
            accessibilityLabel={`Selecionar todas as aulas de ${formatMonthLabel(monthKey)}`}
          >
            <SelectionCheckbox
              checked={allSelected}
              partial={selectedCount > 0 && !allSelected}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className="flex-1 flex-row items-center justify-between px-4 py-3"
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
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
                {selecting && selectedCount > 0
                  ? `${selectedCount}/${lessons.length}`
                  : lessons.length}
              </Text>
            </View>
            <ChevronDown
              size={16}
              color="#9CA3AF"
              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
            />
          </View>
        </TouchableOpacity>
      </View>
      {open && (
        <View className="px-4 pb-2">
          {lessons.map((lesson, i) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              studentInstrument={studentInstrument}
              isFirst={i === 0}
              selecting={selecting}
              selected={selectedIds.has(lesson.id)}
              onPress={() =>
                selecting ? onToggleLesson(lesson.id) : onOpenLesson(lesson.id)
              }
              onLongPress={() => onLongPressLesson(lesson.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}
