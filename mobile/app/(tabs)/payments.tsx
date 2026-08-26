import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  Receipt,
  ChevronRight,
  ChevronDown,
  Check,
  Lock,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { getPaymentUrgency } from '../../lib/paymentUrgency';
import type { Payment } from '../../lib/types/payment';
import { paymentKeys } from '../../lib/queryKeys';
import {
  formatCurrency,
  formatDate,
  formatMonthLabel,
  formatMonthLabelFromKey,
} from '../../lib/paymentFormat';
import { StatusPill } from '../../components/ui/StatusPill';
import { paymentStatusConfig } from '../../lib/status';
import * as Notifications from 'expo-notifications';

// Novo componente — pode ficar no topo do próprio payments.tsx,
// ou em components/PaymentsStatusSection.tsx se preferir separar
function PaymentsStatusSection({
  openPayments,
  openPaymentsByStudent,
  hasMultipleStudentsOpen,
  eligibilityMap,
  selectedIds,
  toggleSelection,
  allSelected,
  selectAll,
  clearSelection,
  router,
}: {
  openPayments: Payment[];
  openPaymentsByStudent: {
    studentId: string;
    name: string;
    payments: Payment[];
  }[];
  hasMultipleStudentsOpen: boolean;
  eligibilityMap: Map<string, boolean>;
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  allSelected: boolean;
  selectAll: () => void;
  clearSelection: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  // Estado 1: tudo em dia
  if (openPayments.length === 0) {
    return (
      <View className="px-5 mt-4">
        <View
          className="bg-white rounded-2xl p-5 flex-row items-center gap-3.5"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
        >
          <View className="w-10 h-10 rounded-xl items-center justify-center bg-[#F3EADD]">
            <Check size={20} color="#B08D57" />
          </View>
          <View className="flex-1">
            <Text
              className="text-[15px] font-medium text-[#1A1A1A] mb-0.5"
              style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
            >
              Tudo em dia
            </Text>
            <Text className="text-[13px] text-gray-500">
              Nenhuma fatura pendente no momento
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Estado 2: exatamente 1 fatura aberta — card único, sem resumo
  if (openPayments.length === 1) {
    const payment = openPayments[0];
    return (
      <View className="px-5 mt-4">
        <OpenPaymentCard
          payment={payment}
          selected={false}
          eligible
          showStudentName={false}
          onToggle={() => {}}
          onViewDetails={() => router.push(`/payment-detail/${payment.id}`)}
          isSingleOpen
          onPay={() => router.push(`/payment/${payment.id}`)}
        />
      </View>
    );
  }

  // Estado 3: 2+ faturas abertas — mantém resumo + lista (comportamento já existente)
  return (
    <View className="px-5 mt-4">
      <View
        className="bg-white rounded-2xl px-5 py-4 mb-3 flex-row items-center justify-between"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 2,
          borderWidth: 1,
          borderColor: '#FEE2E2',
        }}
      >
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text className="text-[11px] font-bold uppercase tracking-widest text-red-600 mb-1">
            {openPayments.length} faturas em aberto
          </Text>
          <Text
            className="text-xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            numberOfLines={1}
          >
            Total: R$
            {formatCurrency(
              openPayments.reduce((s, p) => s + Number(p.amount), 0),
            )}
          </Text>
        </View>
        <TouchableOpacity
          onPress={allSelected ? clearSelection : selectAll}
          className="bg-[#F5F1EA] rounded-full px-3 py-2"
          style={{ flexShrink: 0 }}
        >
          <Text className="text-xs font-bold text-[#B08D57]" numberOfLines={1}>
            {allSelected ? 'Limpar' : 'Selecionar todas'}
          </Text>
        </TouchableOpacity>
      </View>

      {hasMultipleStudentsOpen
        ? openPaymentsByStudent.map(({ studentId, name, payments }) => (
            <View key={studentId} className="mb-2">
              <View className="flex-row items-center gap-2 mb-2 ml-1">
                <View className="w-5 h-5 rounded-full bg-[#B08D57] items-center justify-center">
                  <Text className="text-white text-[10px] font-bold">
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  className="text-xs font-bold uppercase tracking-widest text-gray-500 flex-1"
                  numberOfLines={1}
                >
                  {name}
                </Text>
              </View>
              {payments.map((payment) => (
                <OpenPaymentCard
                  key={payment.id}
                  payment={payment}
                  selected={selectedIds.has(payment.id)}
                  eligible={eligibilityMap.get(payment.id) ?? true}
                  showStudentName={false}
                  onToggle={() => toggleSelection(payment.id)}
                  onViewDetails={() =>
                    router.push(`/payment-detail/${payment.id}`)
                  }
                />
              ))}
            </View>
          ))
        : openPayments.map((payment) => (
            <OpenPaymentCard
              key={payment.id}
              payment={payment}
              selected={selectedIds.has(payment.id)}
              eligible={eligibilityMap.get(payment.id) ?? true}
              showStudentName={false}
              onToggle={() => toggleSelection(payment.id)}
              onViewDetails={() => router.push(`/payment-detail/${payment.id}`)}
            />
          ))}
    </View>
  );
}

// Card de fatura ABERTA. Tocar no card (fora do link "Ver detalhes")
// alterna a seleção pro bundle. "Ver detalhes" abre a tela de
// detalhe sem mexer na seleção.
function OpenPaymentCard({
  payment,
  selected,
  eligible,
  showStudentName,
  onToggle,
  onViewDetails,
  isSingleOpen,
  onPay,
}: {
  payment: Payment;
  selected: boolean;
  eligible: boolean;
  showStudentName: boolean;
  onToggle: () => void;
  onViewDetails: () => void;
  isSingleOpen?: boolean;
  onPay?: () => void;
}) {
  const urgency = getPaymentUrgency(payment.dueDate, payment.status);
  const isOverdue = payment.status === 'OVERDUE';

  // pill do topo: usa o label da urgência (com dias) quando atrasada,
  // senão cai no label padrão do status ("Pendente", "Paga")
  const pillConfig =
    isOverdue && urgency
      ? { ...paymentStatusConfig(payment.status), label: urgency.label }
      : paymentStatusConfig(payment.status);

  // quando o card tem botão de pagamento dedicado (onPay), ele não
  // tem função de seleção — nesse caso o card inteiro deve ser um
  // container "mudo" (View), não um TouchableOpacity, senão o RN
  // ainda mostra o feedback visual de toque (opacity piscando) mesmo
  // sem nenhuma ação acontecer, o que confunde o usuário
  const isSelectable = !onPay && eligible;
  const CardContainer = isSelectable ? TouchableOpacity : View;

  return (
    <CardContainer
      {...(isSelectable ? { activeOpacity: 0.7, onPress: onToggle } : {})}
      className="bg-white rounded-2xl overflow-hidden mb-3"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: selected ? 2 : 0,
        borderColor: '#B08D57',
      }}
    >
      <View className="p-5 flex-row">
        {!onPay && (
          <View className="mr-4 pt-1">
            <View
              className={`w-6 h-6 rounded-full items-center justify-center ${
                selected
                  ? 'bg-[#B08D57]'
                  : eligible
                    ? 'border-2 border-gray-300'
                    : 'bg-gray-100'
              }`}
            >
              {selected && <Check size={14} color="#fff" strokeWidth={3} />}
              {!selected && !eligible && <Lock size={11} color="#B0AA9C" />}
            </View>
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-2 gap-2">
            <Text
              className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex-1"
              numberOfLines={1}
            >
              {showStudentName ? payment.student.name : 'Fatura do mês'}
            </Text>
            <StatusPill {...pillConfig} />
          </View>
          <Text
            className="text-2xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            R$ {formatCurrency(payment.amount)}
          </Text>
          <Text className="text-gray-500 mt-1">
            {formatMonthLabel(payment.referenceMonth)}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-2">
            <Calendar size={14} color="#9CA3AF" />
            <Text className="text-gray-500 text-sm">
              Vencimento: {formatDate(payment.dueDate)}
            </Text>
          </View>

          {!eligible && (
            <Text className="text-[11px] text-gray-400 mt-2 italic">
              Pague as faturas mais antigas de {payment.student.name} primeiro
            </Text>
          )}

          {/* badge de baixo só aparece se NÃO estiver atrasada */}
          {urgency && !isOverdue && (
            <View
              style={{
                backgroundColor: urgency.colorBg,
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 4,
                marginTop: 8,
                alignSelf: 'flex-start',
              }}
            >
              <Text
                style={{
                  color: urgency.colorText,
                  fontSize: 11,
                  fontWeight: 'bold',
                }}
              >
                {urgency.label}
              </Text>
            </View>
          )}

          <View className="flex-column gap-3 mt-3">
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onViewDetails();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flexShrink: 0 }}
            >
              <Text
                className="text-xs font-bold text-[#B08D57] underline text-center"
                numberOfLines={1}
              >
                Ver detalhes
              </Text>
            </TouchableOpacity>

            {isSingleOpen && onPay && (
              <TouchableOpacity
                onPress={onPay}
                className="flex-1 bg-[#B08D57] rounded-xl py-3 items-center"
              >
                <Text className="text-white font-bold text-sm">
                  Pagar fatura
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </CardContainer>
  );
}

// Pill de filtro do histórico ("Todos" + um por aluno).
function HistoryFilterPill({
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
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? '#B08D57' : '#FFFFFF',
        borderWidth: 1,
        borderColor: active ? '#B08D57' : 'rgba(0,0,0,0.08)',
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: active ? '#fff' : '#1A1A1A',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Linha de fatura dentro do histórico (usada tanto na lista flat
// quanto dentro de cada grupo de mês).
function HistoryRow({
  payment,
  showStudentName,
  onPress,
}: {
  payment: Payment;
  showStudentName: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-2xl p-4"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      onPress={onPress}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold">
          {showStudentName ? `${payment.student.name} · ` : ''}
          {formatMonthLabel(payment.referenceMonth)}
        </Text>
        <Text className="text-xs text-gray-500 mt-0.5">
          Venc. {formatDate(payment.dueDate)}
          {payment.paidAt ? ` · Paga em ${formatDate(payment.paidAt)}` : ''}
        </Text>
      </View>
      <View className="items-end mr-2">
        <Text className="text-sm font-bold">
          R$ {formatCurrency(payment.amount)}
        </Text>
        <View className="mt-1">
          <StatusPill {...paymentStatusConfig(payment.status)} />
        </View>
      </View>
      <ChevronRight size={16} color="#D4CFC4" />
    </TouchableOpacity>
  );
}

// Grupo de mês no histórico (accordion) — só usado quando o filtro
// é "Todos", pra não misturar faturas de alunos diferentes numa
// lista só. Dentro de cada mês, cada linha mostra o nome do aluno.
function HistoryMonthGroup({
  monthKey,
  payments,
  onViewDetails,
}: {
  monthKey: string;
  payments: Payment[];
  onViewDetails: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <View
      className="bg-white rounded-2xl overflow-hidden mb-2.5"
      style={{
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
    >
      <TouchableOpacity
        className="flex-row items-center justify-between px-4 py-3"
        onPress={() => setOpen(!open)}
      >
        <Text
          className="text-sm font-semibold"
          style={{ fontFamily: 'PlayfairDisplay_600SemiBold' }}
        >
          {formatMonthLabelFromKey(monthKey)}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs font-medium text-gray-400">
            R$ {formatCurrency(total)}
          </Text>
          <ChevronDown
            size={16}
            color="#9CA3AF"
            style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
          />
        </View>
      </TouchableOpacity>
      {open && (
        <View className="px-4 pb-2">
          {payments.map((payment, i) => (
            <TouchableOpacity
              key={payment.id}
              className="flex-row items-center py-3"
              style={
                i > 0
                  ? { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.04)' }
                  : undefined
              }
              onPress={() => onViewDetails(payment.id)}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text className="text-sm font-medium" numberOfLines={1}>
                  {payment.student.name}
                </Text>
                <Text
                  className="text-xs text-gray-500 mt-0.5"
                  numberOfLines={1}
                >
                  Venc. {formatDate(payment.dueDate)}
                  {payment.paidAt
                    ? ` · Paga em ${formatDate(payment.paidAt)}`
                    : ''}
                </Text>
              </View>
              <View
                style={{
                  alignItems: 'flex-end',
                  marginRight: 8,
                  flexShrink: 0,
                }}
              >
                <Text className="text-sm font-bold" style={{ flexShrink: 0 }}>
                  R$ {formatCurrency(payment.amount)}
                </Text>
                <View className="mt-1">
                  <StatusPill {...paymentStatusConfig(payment.status)} />
                </View>
              </View>
              <ChevronRight size={16} color="#D4CFC4" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Payments() {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [historyFilter, setHistoryFilter] = useState<string>('all'); // <-- NOVO

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: paymentKeys.my(),
    queryFn: async () => {
      const response = await api.get<Payment[]>('/payments/my');
      return response.data;
    },
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.my() });
      Notifications.setBadgeCountAsync(0); // limpa o número vermelho no ícone
    }, [queryClient]),
  );

  const openPayments = useMemo(() => {
    if (!data) return [];
    return data
      .filter((p) => p.status !== 'PAID')
      .sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );
  }, [data]);

  // se uma fatura selecionada sumir de openPayments (ex: acabou de ser
  // paga, e o invalidateQueries trouxe o status novo), ela precisa sair
  // da seleção também — senão o rodapé fica mostrando uma seleção
  // "fantasma" que não existe mais na lista
  useEffect(() => {
    setSelectedIds((prev) => {
      const openIds = new Set(openPayments.map((p) => p.id));
      const next = new Set([...prev].filter((id) => openIds.has(id)));
      // só cria um novo Set se algo realmente mudou, evita re-render à toa
      return next.size === prev.size ? prev : next;
    });
  }, [openPayments]);

  // Agrupa as faturas abertas por aluno — usado só na renderização
  const openPaymentsByStudent = useMemo(() => {
    const map = new Map<string, { name: string; payments: Payment[] }>();
    for (const p of openPayments) {
      if (!map.has(p.studentId)) {
        map.set(p.studentId, { name: p.student.name, payments: [] });
      }
      map.get(p.studentId)!.payments.push(p);
    }
    return Array.from(map.entries()).map(([studentId, v]) => ({
      studentId,
      ...v,
    }));
  }, [openPayments]);

  const hasMultipleStudentsOpen = openPaymentsByStudent.length > 1;

  // "Histórico" agora é TODAS as faturas (pagas + abertas), mais
  // recente primeiro — o backend já manda ordenado por
  // referenceMonth desc, então só filtramos PAID separado se quiser,
  // mas aqui usamos a lista inteira.
  const allPaymentsDesc = useMemo(() => {
    if (!data) return [];
    return [...data].sort(
      (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    );
  }, [data]);

  const distinctStudents = useMemo(
    () => new Set(openPayments.map((p) => p.studentId)),
    [openPayments],
  );
  const showStudentName = distinctStudents.size > 1;

  // Alunos distintos no histórico completo (pode ter mais alunos
  // aqui do que em openPayments, ex: aluno que já pagou tudo).
  const historyStudents = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, string>();
    for (const p of data) {
      if (!map.has(p.studentId)) map.set(p.studentId, p.student.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const showHistoryFilter = historyStudents.length > 1; // <-- NOVO

  // Lista do histórico já filtrada pelo aluno selecionado (ou tudo,
  // se historyFilter === 'all').
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return allPaymentsDesc;
    return allPaymentsDesc.filter((p) => p.studentId === historyFilter);
  }, [allPaymentsDesc, historyFilter]);

  // Agrupamento por mês — só faz sentido com "Todos" selecionado,
  // já que filtrando um aluno específico cai numa fatura por mês.
  const historyByMonth = useMemo(() => {
    const groups: Record<string, Payment[]> = {};
    filteredHistory.forEach((p) => {
      (groups[p.referenceMonth] ??= []).push(p);
    });
    return Object.keys(groups)
      .sort()
      .reverse()
      .map((key) => ({ monthKey: key, payments: groups[key] }));
  }, [filteredHistory]);

  function toggleSelection(paymentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        const payment = openPayments.find((p) => p.id === paymentId);
        if (payment) {
          const sameStudent = openPayments.filter(
            (p) => p.studentId === payment.studentId,
          );
          const idx = sameStudent.findIndex((p) => p.id === paymentId);
          for (let i = idx; i < sameStudent.length; i++) {
            next.delete(sameStudent[i].id);
          }
        }
      } else {
        next.add(paymentId);
      }
      return next;
    });
  }

  // Elegibilidade agora vem PRONTA do backend (isEligibleForPayment),
  // mas essa é a elegibilidade "estática" (sem considerar seleção
  // em andamento). Pra permitir marcar em sequência (ex: julho E
  // agosto do mesmo aluno), uma fatura fica selecionável se:
  // - ela é a mais antiga em aberto do aluno (isEligibleForPayment), OU
  // - a fatura logo anterior (mesmo aluno) já está selecionada
  const eligibilityMap = useMemo(() => {
    const map = new Map<string, boolean>();
    const byStudent = new Map<string, Payment[]>();
    for (const p of openPayments) {
      if (!byStudent.has(p.studentId)) byStudent.set(p.studentId, []);
      byStudent.get(p.studentId)!.push(p);
    }
    for (const [, list] of byStudent) {
      let blocked = false;
      for (const p of list) {
        if (blocked) {
          map.set(p.id, false);
        } else {
          map.set(p.id, true);
          if (!selectedIds.has(p.id)) blocked = true;
        }
      }
    }
    return map;
  }, [openPayments, selectedIds]);

  function selectAll() {
    setSelectedIds(new Set(openPayments.map((p) => p.id)));
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar suas faturas
        </Text>
      </View>
    );
  }

  const hasMultipleOpen = openPayments.length > 1;
  const selectedPayments = openPayments.filter((p) => selectedIds.has(p.id));
  const selectedTotal = selectedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const allSelected =
    selectedIds.size > 0 && selectedIds.size === openPayments.length;

  async function handlePaySelected() {
    if (selectedIds.size === 1) {
      const onlyId = [...selectedIds][0];
      router.push(`/payment/${onlyId}`);
      return;
    }
    try {
      const response = await api.post('/payments/bundle', {
        paymentIds: [...selectedIds],
      });
      router.push(`/payment-bundle/${response.data.id}`);
      // } catch (err) {
      //   console.error('Erro ao criar bundle', err);
      // }
    } catch (err: any) {
      console.error('Erro ao criar bundle:', err?.response?.data ?? err);
    }
  }

  async function resetNotificationsDebug() {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  }
  return (
    <View className="flex-1 bg-[#F5F1EA]">
      <ScrollView className="flex-1">
        <PaymentsStatusSection
          openPayments={openPayments}
          openPaymentsByStudent={openPaymentsByStudent}
          hasMultipleStudentsOpen={hasMultipleStudentsOpen}
          eligibilityMap={eligibilityMap}
          selectedIds={selectedIds}
          toggleSelection={toggleSelection}
          allSelected={allSelected}
          selectAll={selectAll}
          clearSelection={clearSelection}
          router={router}
        />

        {/* {__DEV__ && (
          <View className="px-5 mt-2">
            <TouchableOpacity
              onPress={resetNotificationsDebug}
              className="bg-red-50 border border-red-200 rounded-xl py-3 items-center"
            >
              <Text className="text-red-600 text-xs font-bold">
                🧪 Resetar notificações (debug)
              </Text>
            </TouchableOpacity>
          </View>
        )} */}

        <View className="px-5 mt-2 mb-10">
          <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Histórico de faturas
          </Text>

          {/* Filtro por aluno — só aparece com mais de 1 aluno no histórico */}
          {showHistoryFilter && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              className="mb-3"
            >
              <HistoryFilterPill
                label="Todos"
                active={historyFilter === 'all'}
                onPress={() => setHistoryFilter('all')}
              />
              {historyStudents.map((s) => (
                <HistoryFilterPill
                  key={s.id}
                  label={s.name}
                  active={historyFilter === s.id}
                  onPress={() => setHistoryFilter(s.id)}
                />
              ))}
            </ScrollView>
          )}

          {filteredHistory.length === 0 ? (
            <View className="items-center py-12">
              <Receipt size={32} color="#D4CFC4" strokeWidth={1.5} />
              <Text className="text-gray-400 text-sm mt-3">
                Nenhuma fatura ainda
              </Text>
            </View>
          ) : historyFilter === 'all' && showHistoryFilter ? (
            // "Todos" com múltiplos alunos: agrupa por mês pra não
            // misturar faturas de alunos diferentes numa lista só.
            historyByMonth.map(({ monthKey, payments }) => (
              <HistoryMonthGroup
                key={monthKey}
                monthKey={monthKey}
                payments={payments}
                onViewDetails={(id) => router.push(`/payment-detail/${id}`)}
              />
            ))
          ) : (
            // Um aluno específico (ou só existe 1 aluno no total):
            // lista flat simples, sem accordion — 1 fatura por mês
            // não justifica agrupamento.
            <View className="gap-2.5">
              {filteredHistory.map((payment) => (
                <HistoryRow
                  key={payment.id}
                  payment={payment}
                  showStudentName={false}
                  onPress={() => router.push(`/payment-detail/${payment.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {selectedIds.size > 0 && (
        <View
          className="bg-white px-5 pt-4 pb-8"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 8,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.05)',
          }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-gray-500">
              {selectedIds.size}
              {selectedIds.size === 1
                ? ' fatura selecionada'
                : ' faturas selecionadas'}
            </Text>
            <Text
              className="text-lg font-bold"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              R$ {formatCurrency(selectedTotal)}
            </Text>
          </View>
          <TouchableOpacity
            className="bg-[#B08D57] rounded-xl py-4 items-center"
            onPress={handlePaySelected}
          >
            <Text className="text-white font-bold">
              {selectedIds.size === 1 ? 'Pagar fatura' : 'Pagar faturas'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
