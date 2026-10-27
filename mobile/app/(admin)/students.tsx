import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Search,
  Plus,
  ChevronRight,
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserRound,
  X,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import { firstName } from '../../lib/name';
import { SegmentedControl } from '../../components/ui/SegmentedControl';

// ─── Tipos ────────────────────────────────────────────────────────────

type Student = {
  id: string;
  name: string;
  instrument: string | null;
  age: number | null;
  // Ativo = tem matrícula ativa. Quem encerrou fica "inativo".
  isActive: boolean;
  user: { id: string; name: string; email: string };
};

type PendingPayment = {
  studentId: string;
  status: 'PENDING' | 'OVERDUE';
  student: { user: { name: string } };
};

type Enrollment = {
  isActive: boolean;
  student: { id: string };
  teacher: { user: { name: string } } | null;
};

type StatusFilter = 'ALL' | 'OK' | 'PENDING' | 'OVERDUE';

// Quais alunos a lista mostra. Padrão: só quem tem matrícula ativa.
type ScopeFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

const SCOPE_OPTIONS: { key: ScopeFilter; label: string }[] = [
  { key: 'ACTIVE', label: 'Ativos' },
  { key: 'INACTIVE', label: 'Inativos' },
  { key: 'ALL', label: 'Todos' },
];

const EMPTY_MESSAGE: Record<ScopeFilter, string> = {
  ACTIVE: 'Nenhum aluno ativo encontrado',
  INACTIVE: 'Nenhum aluno inativo',
  ALL: 'Nenhum aluno encontrado',
};

const TOTAL_LABEL: Record<ScopeFilter, string> = {
  ACTIVE: 'Ativos',
  INACTIVE: 'Inativos',
  ALL: 'Total',
};

type StudentWithStatus = Student & {
  status: 'OK' | 'PENDING' | 'OVERDUE';
  teacherName: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────

function statusConfig(status: 'OK' | 'PENDING' | 'OVERDUE') {
  if (status === 'OVERDUE')
    return { label: 'Atrasado', bg: 'bg-red-50', text: 'text-red-700' };
  if (status === 'PENDING')
    return { label: 'Pendente', bg: 'bg-yellow-50', text: 'text-yellow-700' };
  return { label: 'Em dia', bg: 'bg-green-50', text: 'text-green-700' };
}

function StatusBadge({ status }: { status: 'OK' | 'PENDING' | 'OVERDUE' }) {
  const config = statusConfig(status);
  return (
    <View className={`rounded-full px-2.5 py-1 ${config.bg}`}>
      <Text className={`text-[11px] font-bold ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}

// ─── Cards de resumo, agora clicáveis como filtro de status ────────────

function ResumoCard({
  icon: Icon,
  label,
  value,
  bg,
  color,
  active,
  onPress,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  label: string;
  value: number;
  bg: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-1 flex-row items-center gap-3 bg-white rounded-2xl px-3 py-3"
      onPress={onPress}
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
        borderWidth: active ? 1.5 : 0,
        borderColor: active ? '#B08D57' : 'transparent',
      }}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <Icon size={18} color={color} />
      </View>
      <View>
        <Text
          className="text-xl leading-none"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {value}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">{label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Chip de filtro (instrumento / professor) ──────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`rounded-full px-3.5 py-2 mr-2 ${
        active ? 'bg-[#B08D57]' : 'bg-white'
      }`}
      style={
        active ? undefined : { borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }
      }
    >
      <Text
        className={`text-xs font-medium ${
          active ? 'text-white' : 'text-gray-600'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Linha de aluno ─────────────────────────────────────────────────────

function StudentRow({
  student,
  index,
  router,
}: {
  student: StudentWithStatus;
  index: number;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-2xl p-3.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={() => router.push(`/student/${student.id}`)}
    >
      <View className="w-6 items-center mr-2.5">
        <Text className="text-xs font-medium text-gray-400">{index}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium flex-shrink" numberOfLines={1}>
            {firstName(student.name)}
          </Text>
          {!student.isActive && (
            <View className="rounded-full px-2 py-0.5 bg-gray-100">
              <Text className="text-[10px] font-bold text-gray-500">
                Inativo
              </Text>
            </View>
          )}
        </View>
        <Text className="text-[13px] text-gray-500 mt-0.5">
          {formatInstrument(student.instrument)}
          {student.teacherName ? ` · ${student.teacherName}` : ''}
        </Text>
      </View>
      {/* "Em dia" não diz nada de quem já saiu: só mostra se houver pendência */}
      {(student.isActive || student.status !== 'OK') && (
        <View className="mr-2">
          <StatusBadge status={student.status} />
        </View>
      )}
      <ChevronRight size={16} color="#D4CFC4" />
    </TouchableOpacity>
  );
}

// Grupo visual para responsáveis — sempre mostrado, mesmo com 1 aluno
function FamilyGroup({
  responsibleName,
  students,
  startIndex,
  router,
}: {
  responsibleName: string;
  students: StudentWithStatus[];
  startIndex: number;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center gap-2 px-1">
        <UserRound size={14} color="#B08D57" />
        <Text className="text-xs font-medium text-gray-500">
          {responsibleName}
        </Text>
      </View>
      <View className="gap-2.5">
        {students.map((student, i) => (
          <StudentRow
            key={student.id}
            student={student}
            index={startIndex + i}
            router={router}
          />
        ))}
      </View>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────

export default function AdminStudents() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<ScopeFilter>('ACTIVE');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [instrumentFilter, setInstrumentFilter] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string | null>(null);

  const { data: students, isLoading: loadingStudents } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const response = await api.get<Student[]>('/students');
      return response.data;
    },
  });

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['admin-pending-payments'],
    queryFn: async () => {
      const response = await api.get<PendingPayment[]>('/payments/pending');
      return response.data;
    },
  });

  // Busca enrollments só pra extrair o professor de cada aluno.
  // O /students não retorna teacher, então cruzamos aqui no front.
  const { data: enrollments, isLoading: loadingEnrollments } = useQuery({
    queryKey: ['admin-enrollments'],
    queryFn: async () => {
      const response = await api.get<Enrollment[]>('/enrollments');
      return response.data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-payments'] });
    }, [queryClient]),
  );

  if (loadingStudents || loadingPending || loadingEnrollments) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  const pendingMap = new Map<string, 'PENDING' | 'OVERDUE'>();
  pending?.forEach((p) => {
    if (pendingMap.get(p.studentId) !== 'OVERDUE') {
      pendingMap.set(p.studentId, p.status);
    }
  });

  // A lista vem da mais nova pra mais antiga: a matrícula ativa sempre
  // vence; sem ela, vale a mais recente (aluno inativo).
  const teacherByStudentId = new Map<string, string>();
  enrollments?.forEach((e) => {
    if (!e.teacher?.user.name) return;
    if (e.isActive || !teacherByStudentId.has(e.student.id)) {
      teacherByStudentId.set(e.student.id, firstName(e.teacher.user.name));
    }
  });

  // Tudo abaixo (cartões de resumo, chips, busca) vale só para o recorte
  // escolhido em Ativos / Inativos / Todos.
  const withStatus: StudentWithStatus[] = (students ?? [])
    .filter((s) =>
      scope === 'ALL' ? true : scope === 'ACTIVE' ? s.isActive : !s.isActive,
    )
    .map((s) => ({
      ...s,
      status: pendingMap.get(s.id) ?? ('OK' as const),
      teacherName: teacherByStudentId.get(s.id) ?? null,
    }));

  // Listas de opções pros chips, derivadas dos próprios dados
  const instrumentOptions = Array.from(
    new Set(
      withStatus.map((s) => formatInstrument(s.instrument)).filter(Boolean),
    ),
  ) as string[];
  const teacherOptions = Array.from(
    new Set(withStatus.map((s) => s.teacherName).filter(Boolean)),
  ) as string[];

  const search_trim = search.trim().toLowerCase();
  const isSearching = search_trim.length > 0;

  const filtered = withStatus.filter((s) => {
    if (search_trim && !s.name.toLowerCase().includes(search_trim))
      return false;
    if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
    if (instrumentFilter && formatInstrument(s.instrument) !== instrumentFilter)
      return false;
    if (teacherFilter && s.teacherName !== teacherFilter) return false;
    return true;
  });

  const counts = {
    total: withStatus.length,
    ok: withStatus.filter((s) => s.status === 'OK').length,
    pending: withStatus.filter((s) => s.status === 'PENDING').length,
    overdue: withStatus.filter((s) => s.status === 'OVERDUE').length,
  };

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    instrumentFilter !== null ||
    teacherFilter !== null;

  function clearFilters() {
    setStatusFilter('ALL');
    setInstrumentFilter(null);
    setTeacherFilter(null);
  }

  // Trocar o recorte zera os demais filtros: os chips de instrumento e
  // professor mudam junto com a lista.
  function changeScope(next: ScopeFilter) {
    setScope(next);
    clearFilters();
  }

  function toggleStatusFilter(value: StatusFilter) {
    setStatusFilter((current) => (current === value ? 'ALL' : value));
  }

  // Agrupa por responsável (user.id) — sempre agrupado, mesmo com 1 aluno,
  // exceto durante busca ativa (resultado direto, sem agrupamento).
  const groupedByUser = new Map<string, StudentWithStatus[]>();
  filtered.forEach((s) => {
    const key = s.user.id;
    if (!groupedByUser.has(key)) groupedByUser.set(key, []);
    groupedByUser.get(key)!.push(s);
  });

  type ListItem =
    | { kind: 'single'; student: StudentWithStatus }
    | {
        kind: 'family';
        responsibleName: string;
        students: StudentWithStatus[];
      };

  const listItems: ListItem[] = [];
  if (isSearching) {
    filtered.forEach((student) => listItems.push({ kind: 'single', student }));
  } else {
    groupedByUser.forEach((group) => {
      listItems.push({
        kind: 'family',
        responsibleName: group[0].user.name,
        students: group,
      });
    });
  }

  // Numeração sequencial contínua através dos grupos
  let counter = 0;
  const renderedItems = listItems.map((item) => {
    if (item.kind === 'family') {
      const startIndex = counter + 1;
      counter += item.students.length;
      return (
        <FamilyGroup
          key={item.students[0].user.id}
          responsibleName={item.responsibleName}
          students={item.students}
          startIndex={startIndex}
          router={router}
        />
      );
    }
    counter += 1;
    return (
      <StudentRow
        key={item.student.id}
        student={item.student}
        index={counter}
        router={router}
      />
    );
  });

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA] px-5 pt-5">
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

      <View className="mb-4">
        <SegmentedControl
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={changeScope}
        />
      </View>

      {/* Cards de resumo — clicáveis, funcionam como filtro de status */}
      <View className="flex-row gap-2.5 mb-2.5">
        <ResumoCard
          icon={Users}
          label={TOTAL_LABEL[scope]}
          value={counts.total}
          bg="#F3F4F6"
          color="#4B5563"
          active={statusFilter === 'ALL'}
          onPress={() => setStatusFilter('ALL')}
        />
        <ResumoCard
          icon={CheckCircle2}
          label="Em dia"
          value={counts.ok}
          bg="#ECFDF5"
          color="#059669"
          active={statusFilter === 'OK'}
          onPress={() => toggleStatusFilter('OK')}
        />
      </View>
      <View className="flex-row gap-2.5 mb-4">
        <ResumoCard
          icon={Clock}
          label="Pendentes"
          value={counts.pending}
          bg="#FFFBEB"
          color="#D97706"
          active={statusFilter === 'PENDING'}
          onPress={() => toggleStatusFilter('PENDING')}
        />
        <ResumoCard
          icon={AlertTriangle}
          label="Atrasados"
          value={counts.overdue}
          bg="#FEF2F2"
          color="#DC2626"
          active={statusFilter === 'OVERDUE'}
          onPress={() => toggleStatusFilter('OVERDUE')}
        />
      </View>

      <View
        className="flex-row items-center bg-white rounded-full px-4 mb-3"
        style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
      >
        <Search size={16} color="#9CA3AF" />
        <TextInput
          className="flex-1 px-2 py-3"
          placeholder="Buscar aluno por nome..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Chips de instrumento */}
      {instrumentOptions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-2.5"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {instrumentOptions.map((instrument) => (
            <FilterChip
              key={instrument}
              label={formatInstrument(instrument)}
              active={instrumentFilter === instrument}
              onPress={() =>
                setInstrumentFilter((current) =>
                  current === instrument ? null : instrument,
                )
              }
            />
          ))}
        </ScrollView>
      )}

      {/* Chips de professor */}
      {teacherOptions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {teacherOptions.map((teacher) => (
            <FilterChip
              key={teacher}
              label={teacher}
              active={teacherFilter === teacher}
              onPress={() =>
                setTeacherFilter((current) =>
                  current === teacher ? null : teacher,
                )
              }
            />
          ))}
        </ScrollView>
      )}

      {/* Limpar filtros + contagem de resultados */}
      <View className="flex-row items-center justify-between mb-3 px-1">
        <Text className="text-xs text-gray-400">
          {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}
        </Text>
        {hasActiveFilters && (
          <TouchableOpacity
            onPress={clearFilters}
            className="flex-row items-center gap-1"
          >
            <X size={12} color="#B08D57" />
            <Text className="text-xs font-medium text-[#B08D57]">
              Limpar filtros
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="gap-2.5 pb-10">
        {listItems.length === 0 ? (
          <View
            className="bg-white rounded-2xl p-8 items-center"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 1,
            }}
          >
            <Text className="text-sm text-gray-400">
              {EMPTY_MESSAGE[scope]}
            </Text>
          </View>
        ) : (
          renderedItems
        )}
      </View>
    </ScrollView>
  );
}
