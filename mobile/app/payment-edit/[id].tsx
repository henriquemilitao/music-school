// app/payment-edit/[id].tsx
//
// Editar UMA fatura: valor, vencimento, período das aulas e (se paga) o dia do
// pagamento. Só o que mudou é enviado. Mudar o valor ou o vencimento descarta
// o PIX já gerado (um novo é criado com os valores certos).
import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import {
  updatePayment,
  useAdminPayment,
  useRefreshPayments,
} from '../../lib/adminPayments';
import { formatMoneyDigits, maskMoneyDigits } from '../../lib/newStudent';
import {
  buildPaymentPatch,
  isPaymentFormDirty,
  paymentEditShape,
  paymentToForm,
  validatePaymentForm,
  type PaymentEditErrors,
  type PaymentEditForm,
} from '../../lib/paymentEdit';
import { formatMonthLabelFromKey } from '../../lib/paymentFormat';
import { statusForDueDate } from '../../lib/paymentView';
import { parseDate } from '../../lib/newStudent';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { Note } from '../../components/ui/Note';
import { DateField } from '../../components/form/DateField';
import { TextField } from '../../components/form/FormField';

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View>
      <Text
        className="text-lg"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>
      ) : null}
    </View>
  );
}

export default function EditPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refresh = useRefreshPayments();
  const paymentQuery = useAdminPayment(id);
  const payment = paymentQuery.data;

  const initial = useMemo(
    () => (payment ? paymentToForm(payment) : null),
    [payment],
  );
  const shape = useMemo(
    () =>
      payment ? paymentEditShape(payment) : { hasPeriod: false, isPaid: false },
    [payment],
  );

  // Só guardamos o que foi mexido; o resto vem da fatura atual.
  const [draft, setDraft] = useState<Partial<PaymentEditForm>>({});
  const [errors, setErrors] = useState<PaymentEditErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useMemo(
    () => (initial ? { ...initial, ...draft } : null),
    [initial, draft],
  );
  const dirty = !!initial && !!form && isPaymentFormDirty(initial, form);
  const guard = useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: () =>
      updatePayment(id, buildPaymentPatch(initial!, form!, shape)),
    onSuccess: () => {
      if (payment) refresh(payment.studentId, payment.id);
      guard.allowLeave();
      router.back();
    },
    onError: (error: any) =>
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível salvar. Tente novamente.',
      ),
  });

  function patch(next: Partial<PaymentEditForm>) {
    setDraft((current) => ({ ...current, ...next }));
    setSubmitError(null);
    setErrors((current) => {
      const cleared = { ...current };
      (Object.keys(next) as (keyof PaymentEditForm)[]).forEach((key) => {
        delete cleared[key];
      });
      return cleared;
    });
  }

  function handleSave() {
    if (!form) return;
    const found = validatePaymentForm(form, shape);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate();
  }

  if (paymentQuery.isLoading) {
    return (
      <DetailScreen title="Editar fatura">
        <View className="py-24 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!payment || !initial || !form) {
    return (
      <DetailScreen title="Editar fatura">
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

  if (payment.status === 'CANCELLED') {
    return (
      <DetailScreen title="Editar fatura">
        <View className="px-5 pt-6">
          <InlineFeedback
            type="warning"
            message="Esta fatura está cancelada. Reative-a para poder editar."
          />
        </View>
      </DetailScreen>
    );
  }

  const open = payment.status !== 'PAID';
  const amountChanged = form.amountDigits !== initial.amountDigits;
  const dueChanged = form.dueDate !== initial.dueDate;
  const newDueIso = parseDate(form.dueDate);
  // Em aberto: com o vencimento novo ela passa a ser Atrasada ou Pendente
  const statusAfter =
    open && dueChanged && newDueIso
      ? statusForDueDate(`${newDueIso}T12:00:00.000Z`)
      : null;
  const bundlePaid = payment.paymentBundle?.status === 'PAID';
  const bundleOpen = payment.paymentBundle?.status === 'PENDING';

  return (
    <DetailScreen
      title="Editar fatura"
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label="Salvar alterações"
            icon={Check}
            onPress={handleSave}
            loading={save.isPending}
            disabled={!dirty}
          />
        </ActionFooter>
      }
    >
      <View className="px-5 pt-5 pb-10 gap-4">
        <View className="gap-0.5">
          <Text className="text-xs text-gray-400">{payment.student.name}</Text>
          <Text
            className="text-2xl"
            style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
          >
            {formatMonthLabelFromKey(payment.referenceMonth)}
          </Text>
        </View>

        <Card className="gap-5">
          <SectionTitle title="Valor e vencimento" />
          <TextField
            label="Valor da mensalidade"
            required
            prefix="R$"
            value={formatMoneyDigits(form.amountDigits)}
            onChangeText={(text) =>
              patch({ amountDigits: maskMoneyDigits(text) })
            }
            error={errors.amountDigits}
            placeholder="0,00"
            keyboardType="number-pad"
            maxLength={12}
            editable={!bundlePaid}
            hint={
              bundlePaid
                ? 'Paga junto com outras faturas (pagamento agregado): o valor não pode ser alterado aqui.'
                : 'Pagando em dia, o PIX ainda tem o desconto de pontualidade (R$ 20).'
            }
          />
          <DateField
            label="Vencimento"
            required
            value={form.dueDate}
            onChange={(value) => patch({ dueDate: value })}
            error={errors.dueDate}
          />
          {statusAfter && (
            <Note>
              Com esse vencimento a fatura fica{' '}
              {statusAfter === 'OVERDUE' ? 'Atrasada' : 'Pendente'}.
            </Note>
          )}
          {open && (amountChanged || dueChanged) && (
            <Note>
              O PIX que já foi gerado para esta fatura é descartado; um novo é
              criado, com os valores atualizados, quando o aluno for pagar.
              {bundleOpen
                ? ' Esta fatura está num pagamento agregado em aberto: ele é desfeito e as faturas voltam a ser pagas separadamente.'
                : ''}
            </Note>
          )}
        </Card>

        {shape.hasPeriod && (
          <Card className="gap-5">
            <SectionTitle
              title="Período das aulas"
              subtitle="Quais aulas esta fatura cobre. Só muda o que aparece na fatura, as aulas não mudam."
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <DateField
                  label="Início"
                  required
                  value={form.periodStart}
                  onChange={(value) => patch({ periodStart: value })}
                  error={errors.periodStart}
                />
              </View>
              <View className="flex-1">
                <DateField
                  label="Fim"
                  required
                  value={form.periodEnd}
                  onChange={(value) => patch({ periodEnd: value })}
                  error={errors.periodEnd}
                />
              </View>
            </View>
          </Card>
        )}

        {shape.isPaid && (
          <Card className="gap-5">
            <SectionTitle title="Pagamento" />
            <DateField
              label="Dia do pagamento"
              required
              value={form.paidAt}
              onChange={(value) => patch({ paidAt: value })}
              error={errors.paidAt}
              hint="Em pagamento automático (PIX) isso muda só a data registrada."
            />
          </Card>
        )}

        {submitError && <InlineFeedback type="error" message={submitError} />}
      </View>
    </DetailScreen>
  );
}
