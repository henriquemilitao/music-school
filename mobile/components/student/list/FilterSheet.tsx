import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SCOPE_LABELS,
  type ScopeFilter,
  type StudentFilters,
} from '../../../lib/studentList';
import { Button } from '../../ui/Button';

const SCOPES: ScopeFilter[] = ['ACTIVE', 'INACTIVE', 'ALL'];

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="rounded-full px-4 py-2.5"
      style={{
        backgroundColor: selected ? '#B08D57' : '#FFFFFF',
        borderWidth: 1,
        borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.12)',
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text
        className="text-[13px] font-semibold"
        style={{ color: selected ? '#FFFFFF' : '#1A1A1A' }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2.5">
      <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
        {title}
      </Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

// Painel de filtros em folha inferior. As escolhas valem na hora (a lista
// atrás já muda) e o botão de baixo mostra quantos alunos aparecem.
export function FilterSheet({
  visible,
  onClose,
  filters,
  instruments,
  teachers,
  resultCount,
  onChange,
  onReset,
}: {
  visible: boolean;
  onClose: () => void;
  filters: StudentFilters;
  instruments: string[];
  teachers: string[];
  resultCount: number;
  onChange: (change: Partial<StudentFilters>) => void;
  onReset: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onPress={onClose}
        accessibilityLabel="Fechar filtros"
      >
        <Pressable
          className="bg-[#F5F1EA] rounded-t-3xl pt-3"
          style={{ maxHeight: '85%', paddingBottom: insets.bottom + 16 }}
          onPress={() => {}}
        >
          <View className="self-center w-10 h-1 rounded-full bg-gray-300 mb-3" />
          <View className="flex-row items-center justify-between px-5 mb-4">
            <Text
              className="text-xl"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              Filtros
            </Text>
            <TouchableOpacity onPress={onReset} hitSlop={8}>
              <Text className="text-sm font-semibold text-[#B08D57]">
                Limpar
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 20,
              gap: 22,
            }}
          >
            <Section title="Situação do aluno">
              {SCOPES.map((scope) => (
                <Chip
                  key={scope}
                  label={SCOPE_LABELS[scope]}
                  selected={filters.scope === scope}
                  onPress={() => onChange({ scope })}
                />
              ))}
            </Section>

            {instruments.length > 1 && (
              <Section title="Instrumento">
                <Chip
                  label="Todos"
                  selected={filters.instrument === null}
                  onPress={() => onChange({ instrument: null })}
                />
                {instruments.map((instrument) => (
                  <Chip
                    key={instrument}
                    label={instrument}
                    selected={filters.instrument === instrument}
                    onPress={() => onChange({ instrument })}
                  />
                ))}
              </Section>
            )}

            {teachers.length > 1 && (
              <Section title="Professor">
                <Chip
                  label="Todos"
                  selected={filters.teacher === null}
                  onPress={() => onChange({ teacher: null })}
                />
                {teachers.map((teacher) => (
                  <Chip
                    key={teacher}
                    label={teacher}
                    selected={filters.teacher === teacher}
                    onPress={() => onChange({ teacher })}
                  />
                ))}
              </Section>
            )}
          </ScrollView>

          <View className="px-5">
            <Button
              label={`Ver ${resultCount} ${resultCount === 1 ? 'aluno' : 'alunos'}`}
              onPress={onClose}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
