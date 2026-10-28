import { useMemo } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { CheckSquare, Plus } from 'lucide-react-native';
import type { StudentLesson } from '../../../lib/lessonTypes';
import type { Selection } from '../../../lib/useSelection';
import { Card } from '../../ui/Card';
import { ErrorRetry } from '../../ui/ErrorRetry';
import { LessonMonthGroup, lessonMonthKey } from './LessonMonthGroup';

// Agrupa por mês (mais recente primeiro) com as aulas de cada mês também da
// mais nova pra mais antiga.
export function groupLessonsByMonth(lessons: StudentLesson[]) {
  const groups: Record<string, StudentLesson[]> = {};
  lessons
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    )
    .forEach((lesson) => {
      (groups[lessonMonthKey(lesson.scheduledAt)] ??= []).push(lesson);
    });
  return Object.keys(groups)
    .sort()
    .reverse()
    .map((monthKey) => ({ monthKey, lessons: groups[monthKey] }));
}

function ActionPill({
  icon: Icon,
  label,
  primary,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="flex-row items-center gap-1.5 rounded-full px-3.5 h-9"
      style={{
        backgroundColor: primary ? '#B08D57' : '#FFFFFF',
        borderWidth: 1,
        borderColor: primary ? '#B08D57' : 'rgba(0,0,0,0.1)',
      }}
      accessibilityRole="button"
    >
      <Icon size={14} color={primary ? '#FFFFFF' : '#1A1A1A'} />
      <Text
        className="text-[13px] font-semibold"
        style={{ color: primary ? '#FFFFFF' : '#1A1A1A' }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type LessonsTabProps = {
  lessons: StudentLesson[] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  studentInstrument: string | null;
  selection: Selection;
  onOpenLesson: (lessonId: string) => void;
  onNewLesson: () => void;
};

// Aba "Aulas" do aluno: ações no topo (nova aula / selecionar) e as aulas
// agrupadas por mês, com seleção múltipla por toque longo.
export function LessonsTab({
  lessons,
  loading,
  error,
  onRetry,
  studentInstrument,
  selection,
  onOpenLesson,
  onNewLesson,
}: LessonsTabProps) {
  const groups = useMemo(() => groupLessonsByMonth(lessons ?? []), [lessons]);

  if (loading) {
    return (
      <Card>
        <ActivityIndicator color="#B08D57" />
      </Card>
    );
  }

  if (error) {
    return (
      <ErrorRetry
        message="Não foi possível carregar as aulas."
        onRetry={onRetry}
      />
    );
  }

  return (
    <View>
      {!selection.selecting && (
        <View className="flex-row items-center gap-2 mb-3">
          <ActionPill
            icon={Plus}
            label="Nova aula"
            primary
            onPress={onNewLesson}
          />
          {groups.length > 0 && (
            <ActionPill
              icon={CheckSquare}
              label="Selecionar"
              onPress={() => selection.start()}
            />
          )}
        </View>
      )}

      {selection.selecting && (
        <Text className="text-xs text-gray-500 mb-3 px-1">
          Toque nas aulas para marcar. Use os botões abaixo para editar ou
          excluir as marcadas.
        </Text>
      )}

      {groups.length === 0 ? (
        <Card>
          <View className="items-center py-8">
            <Text className="text-sm text-gray-400">
              Nenhuma aula encontrada
            </Text>
          </View>
        </Card>
      ) : (
        groups.map(({ monthKey, lessons: monthLessons }, index) => (
          <LessonMonthGroup
            key={monthKey}
            monthKey={monthKey}
            lessons={monthLessons}
            studentInstrument={studentInstrument}
            defaultOpen={index === 0}
            selecting={selection.selecting}
            selectedIds={selection.ids}
            onOpenLesson={onOpenLesson}
            onToggleLesson={selection.toggle}
            onLongPressLesson={(lessonId) =>
              selection.selecting
                ? selection.toggle(lessonId)
                : selection.start(lessonId)
            }
            onToggleMonth={selection.setMany}
          />
        ))
      )}
    </View>
  );
}
