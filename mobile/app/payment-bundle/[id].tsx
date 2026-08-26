import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Receipt,
  Timer,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { useCountdown } from '../../lib/useCountdown';
import { useAppStateRefetch } from '../../lib/useAppStateRefetch';
import { dashboardKeys, paymentKeys } from '../../lib/queryKeys';
import {
  formatMonthLabel,
  formatFullDate,
  formatDate,
  formatPixCountdown,
  formatCurrency,
} from '../../lib/paymentFormat';
import { paymentStatusConfig } from '../../lib/status';
import { StatusPill } from '../../components/ui/StatusPill';

type BundlePayment = {
  id: string;
  amount: string;
  dueDate: string;
  referenceMonth: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID';
  student: { name: string; instrument: string | null };
};

type Bundle = {
  id: string;
  amount: string;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
  pixCopyPaste: string | null;
  pixQrCode: string | null;
  pixExpiresAt: string | null;
  payments: BundlePayment[];
};

// "válido até 14:47" — horário absoluto de expiração, exibido junto
// com o countdown decrescente. O countdown sozinho cria urgência mas
// exige conta mental caso o usuário saia e volte pro app; o horário
// absoluto resolve isso sem competir visualmente com o countdown.
function formatExpiresAtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaymentBundleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: bundle,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: paymentKeys.bundle(id!),
    queryFn: async () => {
      const response = await api.get<Bundle>(`/payments/bundle/${id}`);
      return response.data;
    },
    enabled: !!id,
    refetchOnMount: 'always',
    refetchInterval: (query) =>
      query.state.data?.status === 'PAID' ? false : 5000,
  });

  useAppStateRefetch(paymentKeys.bundle(id!));

  useEffect(() => {
    if (bundle?.status === 'PAID') {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    }
  }, [bundle?.status, queryClient]);

  const countdown = useCountdown(bundle?.pixExpiresAt ?? null);
  const pixExpired = countdown?.isPast ?? false;

  async function handleCopy() {
    if (!bundle?.pixCopyPaste) return;
    await Clipboard.setStringAsync(bundle.pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !bundle) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA] px-6">
        <Text className="text-red-500 text-center">
          Não foi possível carregar esse pagamento agregado
        </Text>
      </View>
    );
  }

  const isPaid = bundle.status === 'PAID';
  // status do bundle em si (agregado) — reaproveita a mesma paleta de
  // pagamento, tratando 'PENDING' do bundle como o "Aguardando"
  const bundleConfig = paymentStatusConfig(isPaid ? 'PAID' : 'PENDING');

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
        <Text className="text-base font-semibold">
          {isPaid ? 'Pagamento confirmado' : 'Pagamento agregado'}
        </Text>
      </View>

      <View className="px-5 pt-5 pb-2">
        <Text className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
          {bundle.payments.length} faturas
        </Text>
        <View className="flex-row items-end justify-between">
          <Text
            className="text-4xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            R$ {formatCurrency(bundle.amount)}
          </Text>
          <StatusPill
            label={isPaid ? 'Pago' : 'Aguardando pagamento'}
            colorText={bundleConfig.colorText}
            colorBg={bundleConfig.colorBg}
            size="md"
          />
        </View>
      </View>

      <View className="px-5 gap-4 pt-3 pb-10">
        <View
          className="bg-white rounded-2xl overflow-hidden"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="px-5 pt-4 pb-2 flex-row items-center gap-2">
            <Receipt size={16} color="#B08D57" />
            <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Faturas incluídas
            </Text>
          </View>

          {bundle.payments.map((payment, index) => (
            <View
              key={payment.id}
              className="flex-row items-center px-5 py-3"
              style={{
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: 'rgba(0,0,0,0.04)',
              }}
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Text className="text-sm font-semibold">
                    {payment.student.name}
                  </Text>
                  <StatusPill
                    {...paymentStatusConfig(payment.status)}
                    size="sm"
                  />
                </View>
                <Text className="text-xs text-gray-500">
                  {formatMonthLabel(payment.referenceMonth)} · Venc.{' '}
                  {formatDate(payment.dueDate)}
                </Text>
              </View>
              <Text className="text-sm font-bold">
                R$ {formatCurrency(payment.amount)}
              </Text>
            </View>
          ))}
        </View>

        {isPaid && bundle.paidAt && (
          <View
            className="bg-white rounded-2xl p-5 flex-row items-center gap-3"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="w-9 h-9 rounded-xl bg-green-50 items-center justify-center">
              <CheckCircle2 size={17} color="#059669" />
            </View>
            <View>
              <Text className="text-xs text-gray-400">Pago em</Text>
              <Text className="text-sm font-medium">
                {formatFullDate(bundle.paidAt)}
              </Text>
            </View>
          </View>
        )}

        {!isPaid && (
          <View
            className="bg-white rounded-2xl p-5"
            style={{
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-center justify-between mb-1">
              <View className="flex-row items-center gap-2">
                <QrCode size={20} color="#B08D57" />
                <Text className="text-sm font-bold">Pague via PIX</Text>
              </View>

              {countdown && !pixExpired && (
                <View className="items-end">
                  <View className="flex-row items-center gap-1.5 bg-[#F5F1EA] rounded-full px-2.5 py-1">
                    <Timer size={13} color="#B08D57" />
                    <Text className="text-xs font-bold text-[#B08D57]">
                      {formatPixCountdown(countdown.minutes, countdown.seconds)}
                    </Text>
                  </View>
                  {bundle.pixExpiresAt && (
                    <Text className="text-[10px] text-gray-400 mt-1">
                      Válido até {formatExpiresAtTime(bundle.pixExpiresAt)}
                    </Text>
                  )}
                </View>
              )}
            </View>

            {pixExpired ? (
              <View className="items-center py-6">
                <Text className="text-gray-400 text-center text-sm mb-4">
                  Esse código PIX expirou
                </Text>
                <TouchableOpacity
                  className="bg-[#B08D57] rounded-xl px-6 py-3 flex-row items-center gap-2"
                  onPress={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <QrCode size={16} color="#fff" />
                  )}
                  <Text className="text-white font-bold">
                    {isFetching ? 'Gerando...' : 'Gerar novo PIX'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {bundle.pixQrCode ? (
                  <View className="items-center mb-4">
                    <View className="border-2 border-gray-100 rounded-xl p-3">
                      <Image
                        source={{ uri: bundle.pixQrCode }}
                        style={{ width: 200, height: 200 }}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                ) : (
                  <Text className="text-gray-400 text-center text-sm mb-4">
                    O QR code ainda não foi gerado para esse pagamento.
                  </Text>
                )}

                {bundle.pixCopyPaste && (
                  <>
                    <Text className="text-xs text-gray-400 text-center mb-3">
                      Escaneie o QR Code ou copie o código abaixo
                    </Text>

                    <View className="bg-[#F5F1EA] rounded-xl p-3 mb-3">
                      <Text className="text-xs text-gray-500" numberOfLines={1}>
                        {bundle.pixCopyPaste}
                      </Text>
                    </View>

                    <TouchableOpacity
                      className={`rounded-xl py-3.5 flex-row items-center justify-center gap-2 ${
                        copied ? 'bg-green-600' : 'bg-[#B08D57]'
                      }`}
                      onPress={handleCopy}
                    >
                      {copied ? (
                        <Check size={18} color="#fff" />
                      ) : (
                        <Copy size={18} color="#fff" />
                      )}
                      <Text className="text-white font-bold">
                        {copied ? 'Código copiado!' : 'Copiar código PIX'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
