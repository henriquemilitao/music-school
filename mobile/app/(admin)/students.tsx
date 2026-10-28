import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import {
  DEFAULT_FILTERS,
  activeFilterTags,
  buildListItems,
  countByPayment,
  filterOptions,
  filterRows,
  hasAnyFilter,
  type FilterTag,
  type StudentFilters,
  type StudentListItem,
} from '../../lib/studentList';
import { useStudentRows } from '../../lib/useStudentRows';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { ActiveFilterTags } from '../../components/student/list/ActiveFilterTags';
import { FilterSheet } from '../../components/student/list/FilterSheet';
import { PaymentChips } from '../../components/student/list/PaymentChips';
import { StudentSearchBar } from '../../components/student/list/StudentSearchBar';
import {
  StudentGroup,
  StudentRow,
} from '../../components/student/list/StudentRow';

function ItemSeparator() {
  return <View style={{ height: 10 }} />;
}

const keyOf = (item: StudentListItem) => item.key;

// Lista de alunos: busca + botão Filtros, uma faixa de situação de
// pagamento e a lista. Instrumento, professor e Ativos/Inativos ficam no
// painel de filtros, pra não poluir a tela.
//
// Desempenho: a lista é virtualizada (só desenha o que cabe na tela), as
// linhas são memorizadas e a lista acompanha os filtros um instante DEPOIS
// dos botões — assim "Em dia", "Atrasados"... respondem na hora ao toque.
export default function AdminStudents() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { rows, isLoading, isError, isRefetching, refetch } = useStudentRows();

  const [filters, setFilters] = useState<StudentFilters>(DEFAULT_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const listFilters = useDeferredValue(filters);

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
    }, [queryClient]),
  );

  const filtered = useMemo(
    () => filterRows(rows, listFilters),
    [rows, listFilters],
  );
  const counts = useMemo(
    () => countByPayment(rows, listFilters),
    [rows, listFilters],
  );
  const options = useMemo(
    () => filterOptions(rows, filters.scope),
    [rows, filters.scope],
  );
  const items = useMemo(
    () => buildListItems(filtered, listFilters.search.trim().length > 0),
    [filtered, listFilters.search],
  );
  const tags = activeFilterTags(filters);

  function change(partial: Partial<StudentFilters>) {
    setFilters((current) => {
      const next = { ...current, ...partial };
      // Trocar Ativos/Inativos muda as opções de instrumento e professor:
      // zera essas duas escolhas pra não ficar um filtro "fantasma".
      if (partial.scope && partial.scope !== current.scope) {
        next.instrument = null;
        next.teacher = null;
      }
      return next;
    });
  }

  function removeTag(key: FilterTag['key']) {
    if (key === 'scope') change({ scope: DEFAULT_FILTERS.scope });
    if (key === 'instrument') change({ instrument: null });
    if (key === 'teacher') change({ teacher: null });
  }

  const openStudent = useCallback(
    (studentId: string) => router.push(`/student/${studentId}`),
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: StudentListItem }) =>
      item.kind === 'group' ? (
        <StudentGroup
          group={item.group}
          startIndex={item.startIndex}
          onOpen={openStudent}
        />
      ) : (
        <StudentRow
          student={item.student}
          index={item.index}
          onOpen={openStudent}
        />
      ),
    [openStudent],
  );

  const showList = !isLoading && !isError;

  const header = (
    <View>
      <View className="flex-row items-end justify-between mb-4">
        <View>
          <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57] mb-1">
            Gestão
          </Text>
          <Text
            className="text-2xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            Alunos
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/new-student')}
          className="flex-row items-center gap-1.5 rounded-full bg-[#B08D57] pl-3.5 pr-4 h-10"
          accessibilityRole="button"
          accessibilityLabel="Adicionar novo aluno"
        >
          <Plus size={16} color="#fff" />
          <Text className="text-white text-sm font-semibold">Novo aluno</Text>
        </TouchableOpacity>
      </View>

      {showList && (
        <View className="gap-3.5 mb-3.5">
          <StudentSearchBar
            value={filters.search}
            onChange={(search) => change({ search })}
            activeFilters={tags.length}
            onOpenFilters={() => setSheetOpen(true)}
          />

          <PaymentChips
            counts={counts}
            value={filters.payment}
            onChange={(payment) => change({ payment })}
          />

          <ActiveFilterTags
            resultCount={filtered.length}
            tags={tags}
            showClear={hasAnyFilter(filters)}
            onRemove={removeTag}
            onClear={() => setFilters(DEFAULT_FILTERS)}
          />
        </View>
      )}
    </View>
  );

  const empty = isLoading ? (
    <View className="py-20 items-center">
      <ActivityIndicator size="large" color="#B08D57" />
    </View>
  ) : isError ? (
    <ErrorRetry
      message="Não foi possível carregar os alunos."
      onRetry={refetch}
      retrying={isRefetching}
    />
  ) : (
    <View
      className="bg-white rounded-2xl p-8 items-center"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <Text className="text-sm text-gray-400">Nenhum aluno encontrado</Text>
    </View>
  );

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: '#F5F1EA' }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 40,
        }}
        data={showList ? items : []}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
      />

      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        instruments={options.instruments}
        teachers={options.teachers}
        resultCount={filtered.length}
        onChange={change}
        onReset={() =>
          setFilters((current) => ({
            ...DEFAULT_FILTERS,
            search: current.search,
            payment: current.payment,
          }))
        }
      />
    </>
  );
}
