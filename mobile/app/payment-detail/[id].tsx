import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  QrCode,
  AlertTriangle,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import type { Payment } from '../../lib/types/payment';
import { getPaymentUrgency } from '../../lib/paymentUrgency';
import { useAppStateRefetch } from '../../lib/useAppStateRefetch';
import { paymentKeys, dashboardKeys } from '../../lib/queryKeys';
import {
  formatMonthLabel,
  formatFullDate,
  formatCurrency,
} from '../../lib/paymentFormat';
import { paymentStatusConfig } from '../../lib/status';
import { StatusPill } from '../../components/ui/StatusPill';

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data: payment,
    isLoading,
    error,
  } = useQuery({
    queryKey: paymentKeys.detail(id!),
    queryFn: async () => {
      const response = await api.get<Payment>(`/payments/my/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.status === 'PAID' ? false : 5000,
  });

  useAppStateRefetch(paymentKeys.detail(id!));

  useEffect(() => {
    if (payment?.status === 'PAID') {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }
  }, [payment?.status, queryClient]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !payment || !payment.student) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar essa fatura
        </Text>
      </View>
    );
  }

  const isPaid = payment.status === 'PAID';
  const config = paymentStatusConfig(payment.status);

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA]">
      <Stack.Screen options={{ headerShown: false }} />

      <View
        className="flex-row items-center px-4 pt-14 pb-3 bg-[#F5F1EA]"
        style={{ borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)' }}
      >
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white items-center justify-center mr-3"
          style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' }}
          onPress={() => router.back()}
        >
          <ArrowLeft size={18} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-base font-semibold">Detalhes da fatura</Text>
      </View>

      <View className="px-5 pt-5 pb-2">
        <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          {payment.student.name} · {formatMonthLabel(payment.referenceMonth)}
        </Text>
        <View className="flex-row items-end justify-between">
          <Text
            className="text-4xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            R$ {formatCurrency(payment.amount)}
          </Text>
          <StatusPill {...config} size="md" />
        </View>
      </View>

      <View className="px-5 gap-4 pt-3 pb-10">
        <View
          className="bg-white rounded-2xl p-5 gap-3"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-xl bg-[#F3EADD] items-center justify-center">
              <Calendar size={17} color="#B08D57" />
            </View>
            <View>
              <Text className="text-xs text-gray-400">Vencimento</Text>
              <Text className="text-sm font-medium">
                {formatFullDate(payment.dueDate)}
              </Text>
            </View>
          </View>

          {!isPaid &&
            (() => {
              const urgency = getPaymentUrgency(
                payment.dueDate,
                payment.status,
              );
              if (!urgency) return null;
              return (
                <View style={{ alignSelf: 'flex-start' }}>
                  <StatusPill
                    label={urgency.label}
                    colorText={urgency.colorText}
                    colorBg={urgency.colorBg}
                  />
                </View>
              );
            })()}

          {isPaid && payment.paidAt && (
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl bg-green-50 items-center justify-center">
                <CheckCircle2 size={17} color="#059669" />
              </View>
              <View>
                <Text className="text-xs text-gray-400">Pago em</Text>
                <Text className="text-sm font-medium">
                  {formatFullDate(payment.paidAt)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {!isPaid && payment.isEligibleForPayment && (
          <TouchableOpacity
            className="bg-[#B08D57] rounded-2xl py-4 flex-row items-center justify-center gap-2"
            onPress={() => router.push(`/payment/${payment.id}`)}
          >
            <QrCode size={18} color="#fff" />
            <Text className="text-white font-bold">Pagar agora</Text>
          </TouchableOpacity>
        )}

        {!isPaid &&
          !payment.isEligibleForPayment &&
          payment.blockingPaymentId && (
            <TouchableOpacity
              className="bg-white rounded-2xl p-5"
              style={{
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
                borderWidth: 1,
                borderColor: '#FEE2E2',
              }}
              onPress={() =>
                router.push(`/payment-detail/${payment.blockingPaymentId}`)
              }
            >
              <View className="flex-row items-center gap-2 mb-1">
                <AlertTriangle size={16} color="#DC2626" />
                <Text className="text-sm font-bold text-red-600">
                  Existe uma fatura mais antiga em aberto
                </Text>
              </View>
              <Text className="text-xs text-gray-500">
                Pague a fatura mais antiga de {payment.student.name} antes
                desta. Toque aqui para ver os detalhes dela.
              </Text>
            </TouchableOpacity>
          )}
      </View>
    </ScrollView>
  );
}
