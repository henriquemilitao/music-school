import { Text, TouchableOpacity, View } from 'react-native';
import type { LessonTag } from '../../lib/lessonForm';

const TONES = {
  purple: { bg: '#FAF5FF', text: '#7E22CE' },
  green: { bg: '#F0FDF4', text: '#16A34A' },
  gray: { bg: '#F3F4F6', text: '#6B7280' },
} as const;

// Etiquetas de reposição de uma aula ("Reposição da aula de…", "Reposição
// marcada: …", "Sem reposição prevista"). Com `onOpenLesson`, as que apontam
// pra outra aula viram atalho pra ela.
export function LessonTags({
  tags,
  onOpenLesson,
}: {
  tags: LessonTag[];
  onOpenLesson?: (lessonId: string) => void;
}) {
  if (tags.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5">
      {tags.map((tag) => {
        const tone = TONES[tag.tone];
        const pill = (
          <View
            className="rounded-full px-2.5 py-1"
            style={{ backgroundColor: tone.bg }}
          >
            <Text
              className="text-[11px] font-semibold"
              style={{ color: tone.text }}
            >
              {tag.text}
              {onOpenLesson && tag.targetLessonId ? '  ›' : ''}
            </Text>
          </View>
        );

        if (onOpenLesson && tag.targetLessonId) {
          const target = tag.targetLessonId;
          return (
            <TouchableOpacity
              key={tag.text}
              onPress={() => onOpenLesson(target)}
              accessibilityRole="link"
              accessibilityLabel={tag.text}
            >
              {pill}
            </TouchableOpacity>
          );
        }
        return <View key={tag.text}>{pill}</View>;
      })}
    </View>
  );
}
