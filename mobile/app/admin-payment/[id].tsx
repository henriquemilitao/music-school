// app/admin-payment/[id].tsx
//
// Detalhe de uma fatura na visão do admin: mês, período das aulas, valor,
// vencimento, situação e — quando paga — quando/como/quem confirmou. Daqui
// dá para confirmar o pagamento ou desfazer uma confirmação feita sem querer
// (a fatura volta sozinha para pendente ou atrasada, conforme o vencimento).
import { useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Banknote,
  CalendarClock,
  CalendarRange,
  Check,
  CheckCircle2,
  FileText,
  Layers,
  Undo2,
  User,
  UserCheck,
  Wallet,
} from 'lucide-react-native';
import { usePaymentActions, useAdminPayment } from '../../lib/adminPayments';
import {
  formatDate,
  formatDateTime,
  formatMonthLabelFromKey,
  getDisplayAmount,
} from '../../lib/paymentFormat';
import {
  dueHint,
  formatPeriodRange,
  paidVia,
  statusAfterUndo,
  undoBlockedReason,
} from '../../lib/paymentView';
import { paymentStatusConfig } from '../../lib/status';
import { formatCurrencyBRL } from '../../components/student/detail/format';
import { SectionCard } from '../../components/student/detail/SectionCard';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InfoRow } from '../../components/ui/InfoRow';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { StatusPill } from '../../components/ui/StatusPill';

const PAID_VIA_LABEL = {
  MANUAL: 'Confirmado manualmente',
  AUTOMATIC: 'Automático (PIX)',
} as const;

export default function AdminPaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const paymentQuery = useAdminPayment(id);
  const payment = paymentQuery.data;
  const actions = usePaymentActions();
  // Aviso do que acabou de acontecer (some quando a tela fecha)
  const [notice, setNotice] = useState<string | null>(null);

  if (paymentQuery.isLoading) {
    return (
      <DetailScreen title="Fatura">
        <View className="py-24 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!payment) {
    return (
      <DetailScreen title="Fatura">
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

  const status = paymentStatusConfig(payment.status);
  const paid = payment.status === 'PAID';
  const via = paidVia(payment);
  const period = formatPeriodRange(payment.periodStart, payment.periodLastDay);
  const blockedReason = paid ? undoBlockedReason(payment) : null;
  const busy = actions.busyId === payment.id;
  const hasDiscount =
    !!payment.paidAmount &&
    Number(payment.paidAmount) !== Number(payment.amount);

  async function handleConfirm() {
    if (!payment) return;
    setNotice(null);
    if (await actions.confirm(payment)) {
      setNotice('Pagamento confirmado.');
    }
  }

  async function handleUndo() {
    if (!payment) return;
    setNotice(null);
    const backTo = statusAfterUndo(payment.dueDate);
    if (await actions.undo(payment)) {
      setNotice(
        `Pagamento desfeito. A fatura voltou para ${backTo === 'OVERDUE' ? 'Atrasada' : 'Pendente'}.`,
      );
    }
  }

  async function openProof(url: string) {
    if (/^https?:\/\//i.test(url)) await Linking.openURL(url);
  }

  return (
    <DetailScreen
      title="Fatura"
      footer={
        <ActionFooter>
          {paid ? (
            <Button
              label="Desfazer pagamento"
              variant="secondary"
              icon={Undo2}
              onPress={() => void handleUndo()}
              loading={busy}
              disabled={!!blockedReason}
            />
          ) : (
            <Button
              label="Confirmar pagamento"
              icon={Check}
              onPress={() => void handleConfirm()}
              loading={busy}
            />
          )}
        </ActionFooter>
      }
    >
      <View className="px-5 pt-5 pb-6 gap-2.5">
        <Text
          className="text-2xl"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {formatMonthLabelFromKey(payment.referenceMonth)}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2">
          <StatusPill {...status} size="md" />
          {!paid && (
            <Text
              className="text-xs font-semibold"
              style={{
                color: payment.status === 'OVERDUE' ? '#DC2626' : '#6B7280',
              }}
            >
              {dueHint(payment.dueDate)}
            </Text>
          )}
        </View>
        <Text className="text-3xl font-bold mt-1">
          {formatCurrencyBRL(getDisplayAmount(payment))}
        </Text>
      </View>

      <View className="px-5 pb-10">
        {notice && (
          <View className="mb-3">
            <InlineFeedback type="success" message={notice} />
          </View>
        )}
        {blockedReason && (
          <View className="mb-3">
            <InlineFeedback type="warning" message={blockedReason} />
          </View>
        )}

        <SectionCard title="Fatura">
          <View className="gap-4">
            <InfoRow
              icon={User}
              label="Aluno"
              value={payment.student.name}
              actionLabel="Ver perfil"
              onPress={() => router.push(`/student/${payment.student.id}`)}
            />
            <InfoRow
              icon={CalendarRange}
              label="Período das aulas"
              value={period ?? 'Fatura avulsa (sem período)'}
            />
            <InfoRow
              icon={CalendarClock}
              label="Vencimento"
              value={formatDate(payment.dueDate)}
            />
            <InfoRow
              icon={Wallet}
              label="Valor da mensalidade"
              value={formatCurrencyBRL(payment.amount)}
            />
            {hasDiscount && payment.paidAmount && (
              <InfoRow
                icon={Banknote}
                label="Valor cobrado no PIX"
                value={formatCurrencyBRL(payment.paidAmount)}
              />
            )}
          </View>
        </SectionCard>

        <SectionCard
          title="Pagamento"
          status={
            paid
              ? {
                  label: status.label,
                  bg: status.colorBg,
                  text: status.colorText,
                }
              : undefined
          }
        >
          {paid ? (
            <View className="gap-4">
              {payment.paidAt && (
                <InfoRow
                  icon={CheckCircle2}
                  label="Pago em"
                  value={formatDateTime(payment.paidAt)}
                />
              )}
              {via && (
                <InfoRow
                  icon={Banknote}
                  label="Forma"
                  value={PAID_VIA_LABEL[via]}
                />
              )}
              {via === 'MANUAL' && payment.confirmedByName && (
                <InfoRow
                  icon={UserCheck}
                  label="Confirmado por"
                  value={payment.confirmedByName}
                />
              )}
              {payment.proofUrl && (
                <InfoRow
                  icon={FileText}
                  label="Comprovante"
                  value="Abrir comprovante"
                  onPress={() => void openProof(payment.proofUrl!)}
                />
              )}
              {payment.paymentBundle?.status === 'PAID' && (
                <InfoRow
                  icon={Layers}
                  label="Pagamento agregado"
                  value="Paga junto com outras faturas"
                />
              )}
            </View>
          ) : (
            <Text className="text-sm text-gray-500 leading-5">
              Nenhum pagamento registrado. Se o pagamento já foi feito fora do
              app, use “Confirmar pagamento”. Se confirmar sem querer, dá para
              desfazer depois aqui mesmo.
            </Text>
          )}
        </SectionCard>
      </View>
    </DetailScreen>
  );
}
