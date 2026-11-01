// app/payment-confirm/[id].tsx
//
// Confirmar o pagamento de uma fatura na mão: o admin escolhe o DIA em que o
// aluno pagou (hoje por padrão; pode ser um dia anterior) e confirma.
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import {
  confirmPaymentManually,
  useAdminPayment,
  useRefreshPayments,
} from '../../lib/adminPayments';
import { dateToText, parseDate } from '../../lib/newStudent';
import {
  formatDate,
  formatMonthLabelFromKey,
  getDisplayAmount,
} from '../../lib/paymentFormat';
import { dueHint } from '../../lib/paymentView';
import { formatCurrencyBRL } from '../../components/student/detail/format';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { DateField } from '../../components/form/DateField';

export default function ConfirmPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refresh = useRefreshPayments();
  const paymentQuery = useAdminPayment(id);
  const payment = paymentQuery.data;

  // "Hoje" fixo desde que a tela abriu; a pessoa troca se foi outro dia
  const [today] = useState(() => dateToText(new Date()));
  const [paidAt, setPaidAt] = useState<string | null>(null);
  const date = paidAt ?? today;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const iso = parseDate(date);
  const future = !!iso && iso > (parseDate(today) ?? '');
  const dateError = !iso
    ? 'Escolha o dia do pagamento'
    : future
      ? 'O pagamento não pode ser no futuro'
      : undefined;

  const confirm = useMutation({
    mutationFn: () => confirmPaymentManually(id, iso ?? undefined),
    onSuccess: () => {
      if (payment) refresh(payment.studentId, payment.id);
      router.back();
    },
    onError: (error: any) =>
      setSubmitError(
        error?.friendlyMessage ??
          'Não foi possível confirmar o pagamento. Tente novamente.',
      ),
  });

  if (paymentQuery.isLoading) {
    return (
      <DetailScreen title="Confirmar pagamento">
        <View className="py-24 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!payment) {
    return (
      <DetailScreen title="Confirmar pagamento">
        <View className="px-5 pt-6">
          <ErrorRetry
            message="Não foi possível carregar a fatura. Verifique a conexão e tente de novo."
            onRetry={() => void paymentQuery.refetch()}
            retrying={paymentQuery.isRefetching}
          />
        </View>
      </DetailScreen>
    );
  }

  const open = payment.status === 'PENDING' || payment.status === 'OVERDUE';

  return (
    <DetailScreen
      title="Confirmar pagamento"
      keyboardShouldPersistTaps="handled"
      footer={
        open ? (
          <ActionFooter>
            <Button
              label="Confirmar pagamento"
              icon={Check}
              loading={confirm.isPending}
              disabled={!!dateError}
              onPress={() => {
                setSubmitError(null);
                confirm.mutate();
              }}
            />
          </ActionFooter>
        ) : undefined
      }
    >
      <View className="px-5 pt-5 pb-10 gap-4">
        <Card className="gap-1">
          <Text className="text-xs text-gray-400">{payment.student.name}</Text>
          <Text
            className="text-xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {formatMonthLabelFromKey(payment.referenceMonth)}
          </Text>
          <Text className="text-2xl font-bold mt-1">
            {formatCurrencyBRL(getDisplayAmount(payment))}
          </Text>
          <Text className="text-xs text-gray-500 mt-1">
            Vencimento {formatDate(payment.dueDate)} ·{' '}
            {dueHint(payment.dueDate)}
          </Text>
        </Card>

        {!open ? (
          <InlineFeedback
            type="warning"
            message={
              payment.status === 'PAID'
                ? 'Esta fatura já está paga.'
                : 'Esta fatura está cancelada. Reative-a para confirmar o pagamento.'
            }
          />
        ) : (
          <Card className="gap-4">
            <DateField
              label="Dia do pagamento"
              required
              value={date}
              onChange={(value) => {
                setPaidAt(value);
                setSubmitError(null);
              }}
              error={dateError}
              hint="Hoje por padrão. Mude se o aluno pagou em outro dia."
            />
            {submitError && (
              <InlineFeedback type="error" message={submitError} />
            )}
          </Card>
        )}
      </View>
    </DetailScreen>
  );
}
