import { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { NotebookPen } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { formatNotesUpdatedAt } from '../../lib/lessonFormat';

type LessonNotesCardProps = {
  notes: string;
  updatedAt: string | null;
  // Canto direito do título (ex: botão "Editar" no admin).
  action?: ReactNode;
  // Rodapé extra abaixo da data (ex: aviso "visível para o aluno").
  footer?: ReactNode;
};

// Leitura das anotações da aula. O aluno e o admin veem o mesmo card —
// assim o professor enxerga exatamente o que o aluno vai ler.
export function LessonNotesCard({
  notes,
  updatedAt,
  action,
  footer,
}: LessonNotesCardProps) {
  return (
    <Card>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <NotebookPen size={18} color="#B08D57" />
          <Text className="text-sm font-bold">Anotações da aula</Text>
        </View>
        {action}
      </View>

      <Text selectable className="text-[15px] leading-6 text-gray-700">
        {notes}
      </Text>

      {(updatedAt || footer) && (
        <View
          className="mt-4 pt-3 gap-1.5"
          style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' }}
        >
          {updatedAt && (
            <Text className="text-xs text-gray-400">
              {formatNotesUpdatedAt(updatedAt)}
            </Text>
          )}
          {footer}
        </View>
      )}
    </Card>
  );
}
