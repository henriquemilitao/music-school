import { View, Text } from 'react-native';
import { NotebookPen } from 'lucide-react-native';

// Marquinha "Com anotações" das listas de aulas (agenda do admin, aulas
// do aluno) — mostra de longe quais aulas já têm anotação.
export function NotesIndicator() {
  return (
    <View
      className="flex-row items-center gap-1 mt-0.5"
      accessibilityLabel="Aula com anotações"
    >
      <NotebookPen size={11} color="#B08D57" />
      <Text className="text-[11px] text-[#B08D57]">Com anotações</Text>
    </View>
  );
}
