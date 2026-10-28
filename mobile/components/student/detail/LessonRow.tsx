import { Text, TouchableOpacity, View } from 'react-native';
import { CalendarClock, Check, ChevronRight } from 'lucide-react-native';
import { formatInstrument } from '../../../lib/instrument';
import { lessonTags } from '../../../lib/lessonForm';
import { formatLessonTimeRange } from '../../../lib/lessonFormat';
import type { LessonStatus, StudentLesson } from '../../../lib/lessonTypes';
import { firstName } from '../../../lib/name';
import { LessonTags } from '../../lesson/LessonTags';
import { NotesIndicator } from '../../lesson/NotesIndicator';
import { Badge } from './Badge';

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

function statusConfig(status: LessonStatus) {
  if (status === 'COMPLETED')
    return { label: 'Realizada', bg: '#ECFDF5', text: '#059669' };
  if (status === 'CANCELLED')
    return { label: 'Cancelada', bg: '#FEF2F2', text: '#DC2626' };
  return { label: 'Agendada', bg: '#FFFBEB', text: '#D97706' };
}

// Quadradinho de marcação do modo de seleção
export function SelectionCheckbox({
  checked,
  partial = false,
}: {
  checked: boolean;
  // Alguns (não todos) marcados — usado no cabeçalho do mês
  partial?: boolean;
}) {
  const active = checked || partial;
  return (
    <View
      className="w-6 h-6 rounded-md items-center justify-center"
      style={{
        backgroundColor: active ? '#B08D57' : '#FFFFFF',
        borderWidth: 2,
        borderColor: active ? '#B08D57' : '#D4CFC4',
      }}
    >
      {checked ? (
        <Check size={14} color="#fff" strokeWidth={3} />
      ) : partial ? (
        <View className="w-2.5 h-0.5 bg-white rounded-full" />
      ) : null}
    </View>
  );
}

type LessonRowProps = {
  lesson: StudentLesson;
  // Instrumento do aluno — só mostramos o da aula quando é outro
  studentInstrument: string | null;
  isFirst: boolean;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

// Uma aula na lista do aluno. Toque abre o detalhe; toque longo (ou
// "Selecionar") liga o modo de seleção, em que o toque marca/desmarca.
export function LessonRow({
  lesson,
  studentInstrument,
  isFirst,
  selecting,
  selected,
  onPress,
  onLongPress,
}: LessonRowProps) {
  const cfg = statusConfig(lesson.status);
  const otherInstrument =
    lesson.instrument && lesson.instrument !== studentInstrument
      ? formatInstrument(lesson.instrument)
      : null;
  const details = [
    formatLessonTimeRange(lesson.scheduledAt, lesson.durationMinutes),
    lesson.teacher ? firstName(lesson.teacher.user.name) : null,
    otherInstrument,
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = lessonTags(lesson);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.7}
      className="flex-row items-center justify-between py-3 -mx-2 px-2 rounded-xl"
      style={{
        backgroundColor: selected ? '#F3EADD' : 'transparent',
        ...(!isFirst && !selected
          ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }
          : null),
      }}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityHint={
        selecting ? undefined : 'Toque para abrir. Segure para selecionar'
      }
    >
      <View className="flex-row items-center gap-3 flex-1">
        {selecting ? (
          <SelectionCheckbox checked={selected} />
        ) : (
          <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
            <CalendarClock size={16} color="#B08D57" />
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className="text-sm font-medium">
            {formatWeekdayDate(lesson.scheduledAt)}
          </Text>
          <Text className="text-xs text-gray-500">{details}</Text>
          {lesson.notes ? <NotesIndicator /> : null}
          <LessonTags tags={tags} />
        </View>
      </View>
      <View className="flex-row items-center gap-2 pl-2">
        <Badge label={cfg.label} bg={cfg.bg} color={cfg.text} />
        {!selecting && <ChevronRight size={16} color="#D4CFC4" />}
      </View>
    </TouchableOpacity>
  );
}
