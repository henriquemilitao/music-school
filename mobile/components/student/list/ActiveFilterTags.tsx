import { Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { FilterTag } from '../../../lib/studentList';

// Linha de resultado: "12 alunos" + etiquetas removíveis dos filtros que
// estão ligados no painel + "Limpar".
export function ActiveFilterTags({
  resultCount,
  tags,
  showClear,
  onRemove,
  onClear,
}: {
  resultCount: number;
  tags: FilterTag[];
  showClear: boolean;
  onRemove: (key: FilterTag['key']) => void;
  onClear: () => void;
}) {
  return (
    <View className="flex-row flex-wrap items-center gap-2 px-1">
      <Text className="text-xs text-gray-400">
        {resultCount} {resultCount === 1 ? 'aluno' : 'alunos'}
      </Text>
      {tags.map((tag) => (
        <TouchableOpacity
          key={tag.key}
          onPress={() => onRemove(tag.key)}
          className="flex-row items-center gap-1 rounded-full px-2.5 py-1 bg-[#F3EADD]"
          accessibilityRole="button"
          accessibilityLabel={`Remover filtro ${tag.label}`}
        >
          <Text className="text-xs font-semibold text-[#8A6A38]">
            {tag.label}
          </Text>
          <X size={11} color="#8A6A38" />
        </TouchableOpacity>
      ))}
      {showClear && (
        <TouchableOpacity onPress={onClear} hitSlop={8}>
          <Text className="text-xs font-medium text-[#B08D57]">Limpar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
