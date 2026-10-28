import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

// Busca por nome + botão que abre o painel de filtros (com um selo
// mostrando quantos filtros estão ligados).
export function StudentSearchBar({
  value,
  onChange,
  activeFilters,
  onOpenFilters,
}: {
  value: string;
  onChange: (text: string) => void;
  activeFilters: number;
  onOpenFilters: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        className="flex-1 flex-row items-center bg-white rounded-full px-4"
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <Search size={16} color="#9CA3AF" />
        <TextInput
          className="flex-1 px-2 py-3"
          placeholder="Buscar aluno por nome..."
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChange}
          returnKeyType="search"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <TouchableOpacity
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityLabel="Limpar busca"
          >
            <X size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        onPress={onOpenFilters}
        className="w-11 h-11 rounded-full items-center justify-center"
        style={{
          backgroundColor: activeFilters > 0 ? '#B08D57' : '#FFFFFF',
          borderWidth: 1,
          borderColor: activeFilters > 0 ? '#B08D57' : 'rgba(0,0,0,0.05)',
        }}
        accessibilityRole="button"
        accessibilityLabel={
          activeFilters > 0 ? `Filtros (${activeFilters} ligados)` : 'Filtros'
        }
      >
        <SlidersHorizontal
          size={18}
          color={activeFilters > 0 ? '#FFFFFF' : '#1A1A1A'}
        />
        {activeFilters > 0 && (
          <View
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1"
            style={{ backgroundColor: '#1A1A1A' }}
          >
            <Text className="text-[10px] font-bold text-white">
              {activeFilters}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}
