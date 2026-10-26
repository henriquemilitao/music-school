import { View, Text, TextInput } from 'react-native';
import { Eye } from 'lucide-react-native';
import {
  LESSON_NOTES_COUNTER_FROM,
  LESSON_NOTES_MAX_LENGTH,
  LESSON_NOTES_PLACEHOLDER,
} from '../../lib/lessonNotes';

type LessonNotesEditorProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  error?: string | null;
};

// Campo de escrita das anotações. Ocupa o espaço disponível (flex-1) —
// quem usa decide onde ficam os botões de salvar/cancelar.
export function LessonNotesEditor({
  value,
  onChangeText,
  editable = true,
  error,
}: LessonNotesEditorProps) {
  const length = value.length;
  const atLimit = length >= LESSON_NOTES_MAX_LENGTH;

  return (
    <View className="flex-1">
      <View
        className="flex-1 bg-white rounded-2xl px-4 py-3"
        style={{
          borderWidth: 1,
          borderColor: error ? '#FCA5A5' : 'rgba(0,0,0,0.06)',
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          multiline
          autoFocus
          autoCapitalize="sentences"
          maxLength={LESSON_NOTES_MAX_LENGTH}
          placeholder={LESSON_NOTES_PLACEHOLDER}
          placeholderTextColor="#B0AA9C"
          textAlignVertical="top"
          className="flex-1 text-[15px] leading-6 text-[#1A1A1A]"
          style={{ minHeight: 160 }}
          accessibilityLabel="Anotações da aula"
        />
      </View>

      <View className="flex-row items-center justify-between gap-3 mt-2.5 px-1">
        <View className="flex-row items-center gap-1.5 flex-1">
          <Eye size={13} color="#9CA3AF" />
          <Text className="text-xs text-gray-400 flex-1">
            O aluno vê essas anotações no app dele.
          </Text>
        </View>
        {length >= LESSON_NOTES_COUNTER_FROM && (
          <Text
            className={`text-xs ${atLimit ? 'text-red-500' : 'text-gray-400'}`}
          >
            {length.toLocaleString('pt-BR')}/
            {LESSON_NOTES_MAX_LENGTH.toLocaleString('pt-BR')}
          </Text>
        )}
      </View>

      {error && (
        <Text
          className="text-xs text-red-600 mt-2 px-1"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      )}
    </View>
  );
}
