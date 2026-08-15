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
