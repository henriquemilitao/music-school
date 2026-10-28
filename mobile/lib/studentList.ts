// lib/studentList.ts
//
// Regras da lista de alunos do admin, sem tela nenhuma: monta as linhas
// (aluno + situação de pagamento + professor), aplica os filtros e conta
// resultados. Funções puras — fáceis de testar e de reaproveitar.
import { formatInstrument } from './instrument';
import { firstName, normalizeText } from './name';

// ─── Tipos ────────────────────────────────────────────────────────────

export type PaymentState = 'OK' | 'PENDING' | 'OVERDUE';
export type PaymentFilter = 'ALL' | PaymentState;
export type ScopeFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

export type StudentApi = {
  id: string;
  name: string;
  instrument: string | null;
  age: number | null;
  // Ativo = tem matrícula ativa. Backend antigo não manda o campo: nesse
  // caso tratamos como ativo (só `false` explícito é inativo).
  isActive?: boolean;
  user: { id: string; name: string; email: string };
};

export type PendingPaymentApi = {
  studentId: string;
  status: 'PENDING' | 'OVERDUE';
};

export type EnrollmentApi = {
  isActive: boolean;
  student: { id: string };
  teacher: { user: { name: string } } | null;
};

export type StudentRowData = StudentApi & {
  inactive: boolean;
  payment: PaymentState;
  teacherName: string | null;
  instrumentLabel: string;
};

export type StudentFilters = {
  search: string;
  scope: ScopeFilter;
  payment: PaymentFilter;
  instrument: string | null; // rótulo exibido (ex: "Piano")
  teacher: string | null; // primeiro nome
};

export const DEFAULT_FILTERS: StudentFilters = {
  search: '',
  scope: 'ACTIVE',
  payment: 'ALL',
  instrument: null,
  teacher: null,
};

export const SCOPE_LABELS: Record<ScopeFilter, string> = {
  ACTIVE: 'Ativos',
  INACTIVE: 'Inativos',
  ALL: 'Todos',
};

// ─── Montagem das linhas ──────────────────────────────────────────────

export function buildRows(
  students: StudentApi[],
  pending: PendingPaymentApi[],
  enrollments: EnrollmentApi[],
): StudentRowData[] {
  // Atrasado vence pendente
  const paymentByStudent = new Map<string, 'PENDING' | 'OVERDUE'>();
  pending.forEach((p) => {
    if (paymentByStudent.get(p.studentId) !== 'OVERDUE') {
      paymentByStudent.set(p.studentId, p.status);
    }
  });

  // A lista de matrículas vem da mais nova pra mais antiga: a ativa sempre
  // vence; sem ela, vale a mais recente (aluno inativo).
  const teacherByStudent = new Map<string, string>();
  enrollments.forEach((e) => {
    const name = e.teacher?.user.name;
    if (!name) return;
    if (e.isActive || !teacherByStudent.has(e.student.id)) {
      teacherByStudent.set(e.student.id, firstName(name));
    }
  });

  return students.map((s) => ({
    ...s,
    inactive: s.isActive === false,
    payment: paymentByStudent.get(s.id) ?? 'OK',
    teacherName: teacherByStudent.get(s.id) ?? null,
    instrumentLabel: formatInstrument(s.instrument),
  }));
}

// ─── Filtros ──────────────────────────────────────────────────────────

function inScope(row: StudentRowData, scope: ScopeFilter) {
  if (scope === 'ALL') return true;
  return scope === 'INACTIVE' ? row.inactive : !row.inactive;
}

// `skip` ignora um filtro — usado pra contar "quantos teria se eu trocasse
// este filtro" (os números dos chips de pagamento).
function matches(
  row: StudentRowData,
  filters: StudentFilters,
  skip?: 'payment',
) {
  if (!inScope(row, filters.scope)) return false;

  const query = normalizeText(filters.search);
  if (query && !normalizeText(row.name).includes(query)) return false;

  if (skip !== 'payment') {
    if (filters.payment !== 'ALL' && row.payment !== filters.payment)
      return false;
  }
  if (filters.instrument && row.instrumentLabel !== filters.instrument)
    return false;
  if (filters.teacher && row.teacherName !== filters.teacher) return false;
  return true;
}

export function filterRows(rows: StudentRowData[], filters: StudentFilters) {
  return rows.filter((row) => matches(row, filters));
}

export type PaymentCounts = Record<PaymentFilter, number>;

export function countByPayment(
  rows: StudentRowData[],
  filters: StudentFilters,
): PaymentCounts {
  const counts: PaymentCounts = { ALL: 0, OK: 0, PENDING: 0, OVERDUE: 0 };
  rows.forEach((row) => {
    if (!matches(row, filters, 'payment')) return;
    counts.ALL += 1;
    counts[row.payment] += 1;
  });
  return counts;
}

// Opções de instrumento/professor do recorte escolhido (Ativos/Inativos/Todos)
export function filterOptions(rows: StudentRowData[], scope: ScopeFilter) {
  const scoped = rows.filter((row) => inScope(row, scope));
  const unique = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((v): v is string => !!v && v !== '—')));
  return {
    instruments: unique(scoped.map((r) => r.instrumentLabel)).sort(),
    teachers: unique(scoped.map((r) => r.teacherName)).sort(),
  };
}

// Filtros "escondidos" no painel (o que não está visível na tela principal):
// viram etiquetas removíveis e o número no botão Filtros.
export type FilterTag = {
  key: 'scope' | 'instrument' | 'teacher';
  label: string;
};

export function activeFilterTags(filters: StudentFilters): FilterTag[] {
  const tags: FilterTag[] = [];
  if (filters.scope !== DEFAULT_FILTERS.scope) {
    tags.push({ key: 'scope', label: SCOPE_LABELS[filters.scope] });
  }
  if (filters.instrument)
    tags.push({ key: 'instrument', label: filters.instrument });
  if (filters.teacher)
    tags.push({ key: 'teacher', label: `Prof. ${filters.teacher}` });
  return tags;
}

export function hasAnyFilter(filters: StudentFilters) {
  return (
    activeFilterTags(filters).length > 0 ||
    filters.payment !== 'ALL' ||
    filters.search.trim().length > 0
  );
}

// ─── Agrupamento por responsável ──────────────────────────────────────

export type GuardianGroup = {
  guardianId: string;
  guardianName: string;
  students: StudentRowData[];
};

export function groupByGuardian(rows: StudentRowData[]): GuardianGroup[] {
  const groups = new Map<string, GuardianGroup>();
  rows.forEach((row) => {
    const group = groups.get(row.user.id) ?? {
      guardianId: row.user.id,
      guardianName: row.user.name,
      students: [],
    };
    group.students.push(row);
    groups.set(row.user.id, group);
  });
  return [...groups.values()];
}
