import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UserMinus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { confirmAsync } from '../../lib/confirm';
import { firstName } from '../../lib/name';
import {
  formatLessonShortDate,
  formatLessonTime,
} from '../../lib/lessonFormat';
import { formatMonthLabelFromKey } from '../../lib/paymentFormat';
import { paymentStatusConfig } from '../../lib/status';
import {
  endEnrollment,
  fetchEndOptions,
  fetchEndPreview,
  fetchUpcomingLessons,
  studentAdminKeys,
  useRefreshStudentData,
  type EndMode,
  type EndTarget,
  type PaymentDecision,
} from '../../lib/studentAdmin';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { OptionRow } from '../../components/form/OptionRow';
import type { EnrollmentSummary } from '../../components/student/detail/EnrollmentCard';
import {
  formatCurrencyBRL,
  formatEndsAt,
} from '../../components/student/detail/format';
import { EndModePicker } from '../../components/student/end/EndModePicker';
import { EndSummary } from '../../components/student/end/EndSummary';
import {
  invoiceDueLabel,
  invoicePeriodLabel,
} from '../../components/student/end/invoiceLabels';
import { InfoNotice } from '../../components/student/end/InfoNotice';
import { LockedPaymentRow } from '../../components/student/end/LockedPaymentRow';
import { PaymentDecisionRow } from '../../components/student/end/PaymentDecisionRow';

type StudentLite = { id: string; name: string };

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View>
      <Text
        className="text-lg"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {title}
      </Text>
      <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>
    </View>
  );
}

export default function EndEnrollment() {
  // O id da rota é o do ALUNO
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refreshStudent = useRefreshStudentData();

  const { data: student } = useQuery({
    queryKey: ['admin-student', id],
    queryFn: async () => (await api.get<StudentLite>(`/students/${id}`)).data,
    enabled: !!id,
  });
  const { data: enrollment, isLoading: loadingEnrollment } = useQuery({
    queryKey: ['admin-student-enrollment', id],
    queryFn: async () =>
      (await api.get<EnrollmentSummary | null>(`/enrollments/student/${id}`))
        .data,
    enabled: !!id,
  });

  // Nada vem marcado: o admin escolhe como encerrar
  const [mode, setMode] = useState<EndMode | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  // Só guardamos o que o admin mexeu; o resto segue a sugestão do servidor
  const [overrides, setOverrides] = useState<Record<string, PaymentDecision>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Aulas (só no modo "a partir de uma aula") ──
  const lessonsQuery = useQuery({
    queryKey: studentAdminKeys.upcoming(enrollment?.id ?? ''),
    queryFn: () => fetchUpcomingLessons(enrollment!.id),
    enabled: !!enrollment && mode === 'FROM_LESSON',
  });
  const lessons = lessonsQuery.data ?? [];

  // ── Faturas para escolher (só no modo "ao fim de uma fatura") ──
  const invoicesQuery = useQuery({
    queryKey: studentAdminKeys.endOptions(enrollment?.id ?? ''),
    queryFn: () => fetchEndOptions(enrollment!.id),
    enabled: !!enrollment && mode === 'AFTER_INVOICE',
  });

  // Alvo pronto = modo + (aula ou fatura, quando o modo pede)
  const target: EndTarget | null =
    mode === 'NOW'
      ? { mode }
      : mode === 'FROM_LESSON' && lessonId
        ? { mode, fromLessonId: lessonId }
        : mode === 'AFTER_INVOICE' && invoiceId
          ? { mode, afterPaymentId: invoiceId }
          : null;

  const previewQuery = useQuery({
    queryKey: studentAdminKeys.endPreview(
      enrollment?.id ?? '',
      target ?? { mode: 'NOW' },
    ),
    queryFn: () => fetchEndPreview(enrollment!.id, target!),
    enabled: !!enrollment && !!target,
  });
  const preview = previewQuery.data;

  // Nada mexido = a fatura continua como está
  const decisionOf = (paymentId: string): PaymentDecision =>
    overrides[paymentId] ?? 'KEEP';

  const payments = preview?.payments ?? [];
  // Travadas (ao fim de uma fatura) sempre saem; as demais seguem a escolha
  const toDelete = payments.filter(
    (p) => p.locked || decisionOf(p.id) === 'DELETE',
  );
  const refunded = toDelete.filter((p) => p.status === 'PAID');
  const toMarkPaid = payments.filter(
    (p) => !p.locked && decisionOf(p.id) === 'MARK_PAID',
  );

  const end = useMutation({
    mutationFn: () =>
      endEnrollment(enrollment!.id, {
        ...target!,
        ...(target!.mode === 'AFTER_INVOICE'
          ? {}
          : { deletePaymentIds: toDelete.map((p) => p.id) }),
        markPaidPaymentIds: toMarkPaid.map((p) => p.id),
      }),
    onSuccess: () => {
      refreshStudent(id);
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível encerrar. Tente novamente.',
      );
    },
  });

  function chooseMode(next: EndMode) {
    if (next === mode) return;
    setMode(next);
    setLessonId(null);
    setInvoiceId(null);
    setOverrides({});
    setSubmitError(null);
  }

  function chooseLesson(next: string) {
    setLessonId(next);
    setOverrides({}); // outra aula de corte muda as sugestões
    setSubmitError(null);
  }

  function chooseInvoice(next: string) {
    setInvoiceId(next);
    setSubmitError(null);
  }

  async function handleEnd() {
    if (!preview || !student) return;
    setSubmitError(null);

    const refundNote =
      refunded.length > 0
        ? ` (${plural(refunded.length, 'já paga, será estornada', 'já pagas, serão estornadas')})`
        : '';
    const paidNote =
      toMarkPaid.length > 0
        ? ` ${plural(toMarkPaid.length, 'fatura será marcada como paga', 'faturas serão marcadas como pagas')}.`
        : '';
    const when = preview.endsAt
      ? `O aluno segue ativo até ${formatEndsAt(preview.endsAt)} e depois fica inativo.`
      : 'O aluno ficará inativo agora.';
    const ok = await confirmAsync({
      title: `Encerrar a matrícula de ${firstName(student.name)}?`,
      message: `${plural(preview.lessonsCancelled, 'aula será cancelada', 'aulas serão canceladas')} e ${plural(toDelete.length, 'fatura será apagada', 'faturas serão apagadas')}${refundNote}.${paidNote} ${when}\n\nNão dá para desfazer.`,
      confirmText: 'Encerrar matrícula',
      destructive: true,
    });
    if (ok) end.mutate();
  }

  if (loadingEnrollment) {
    return (
      <DetailScreen title="Encerrar matrícula">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!enrollment) {
    return (
      <DetailScreen title="Encerrar matrícula">
        <View className="py-20 px-8 items-center">
          <Text className="text-sm text-gray-500 text-center">
            Este aluno não tem matrícula ativa.
          </Text>
        </View>
      </DetailScreen>
    );
  }

  const name = student ? firstName(student.name) : 'o aluno';

  return (
    <DetailScreen
      title="Encerrar matrícula"
      contentPadding
      footer={
        <ActionFooter>
          <Button
            label="Encerrar matrícula"
            variant="danger"
            icon={UserMinus}
            onPress={() => void handleEnd()}
            disabled={!target || !preview || previewQuery.isFetching}
            loading={end.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        {/* 1) Como encerrar */}
        <Card className="gap-4">
          <SectionTitle
            title="Como encerrar?"
            subtitle={`Escolha como a matrícula de ${name} termina.`}
          />
          <EndModePicker value={mode} onChange={chooseMode} />
        </Card>

        {/* 2a) A partir de qual aula */}
        {mode === 'FROM_LESSON' ? (
          <Card className="gap-4">
            <SectionTitle
              title="A partir de qual aula?"
              subtitle="A aula escolhida e todas as seguintes serão canceladas e ficam no histórico como canceladas. As anteriores não mudam."
            />
            {lessonsQuery.isLoading ? (
              <ActivityIndicator color="#B08D57" />
            ) : lessonsQuery.isError ? (
              <ErrorRetry
                message="Não foi possível carregar as aulas agendadas."
                onRetry={() => void lessonsQuery.refetch()}
                retrying={lessonsQuery.isFetching}
              />
            ) : lessons.length === 0 ? (
              <Text className="text-sm text-gray-500">
                Não há aulas futuras agendadas. Use “Encerrar agora”.
              </Text>
            ) : (
              <View className="gap-2.5">
                {lessons.map((lesson, index) => (
                  <OptionRow
                    key={lesson.id}
                    selected={lesson.id === lessonId}
                    title={`${formatLessonShortDate(lesson.scheduledAt)} · ${formatLessonTime(lesson.scheduledAt)}`}
                    subtitle={
                      lesson.isMakeup
                        ? 'Reposição'
                        : index === 0
                          ? 'Próxima aula'
                          : undefined
                    }
                    onPress={() => chooseLesson(lesson.id)}
                  />
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {/* 2b) Ao fim de qual fatura */}
        {mode === 'AFTER_INVOICE' ? (
          <Card className="gap-4">
            <SectionTitle
              title="Ao fim de qual fatura?"
              subtitle="As aulas depois do período da fatura escolhida serão canceladas e as faturas seguintes, apagadas."
            />
            {invoicesQuery.isLoading ? (
              <ActivityIndicator color="#B08D57" />
            ) : invoicesQuery.isError ? (
              <ErrorRetry
                message="Não foi possível carregar as faturas."
                onRetry={() => void invoicesQuery.refetch()}
                retrying={invoicesQuery.isFetching}
              />
            ) : (invoicesQuery.data?.payments.length ?? 0) === 0 ? (
              <Text className="text-sm text-gray-500">
                Não há faturas com período de aulas. Use “Encerrar agora” ou “a
                partir de uma aula”.
              </Text>
            ) : (
              <View className="gap-2.5">
                {invoicesQuery.data!.payments.map((invoice) => (
                  <OptionRow
                    key={invoice.id}
                    selected={invoice.id === invoiceId}
                    title={`${formatMonthLabelFromKey(invoice.referenceMonth)} · ${formatCurrencyBRL(invoice.amount)}`}
                    subtitle={`${invoicePeriodLabel(invoice)}\n${invoiceDueLabel(invoice)} · ${paymentStatusConfig(invoice.status).label}`}
                    onPress={() => chooseInvoice(invoice.id)}
                  />
                ))}
                {invoicesQuery.data!.olderPaymentsCount > 0 ? (
                  <Text className="text-xs text-gray-400">
                    Mostrando as 3 faturas mais recentes.
                  </Text>
                ) : null}
              </View>
            )}
          </Card>
        ) : null}

        {/* 3) Faturas */}
        {target ? (
          <Card className="gap-4">
            {mode === 'AFTER_INVOICE' ? (
              <SectionTitle
                title="Faturas"
                subtitle="As faturas depois da escolhida saem do sistema. A escolhida continua; se já foi paga, marque abaixo."
              />
            ) : (
              <SectionTitle
                title="O que fazer com as faturas?"
                subtitle="Mostramos as 3 mais recentes, da mais nova para a mais antiga. Escolha o que fica, o que já foi pago e o que sai."
              />
            )}

            {payments.length > 0 ? (
              <InfoNotice>
                {mode === 'AFTER_INVOICE'
                  ? 'As faturas marcadas “Será apagada” saem do sistema. Se você não alterar nada na fatura escolhida, ela continua como está.'
                  : 'Se você não alterar nada, todas as faturas continuam como estão.'}
              </InfoNotice>
            ) : null}

            {previewQuery.isError ? (
              <ErrorRetry
                message="Não foi possível carregar as faturas."
                onRetry={() => void previewQuery.refetch()}
                retrying={previewQuery.isFetching}
              />
            ) : previewQuery.isLoading ? (
              <ActivityIndicator color="#B08D57" />
            ) : payments.length === 0 ? (
              <Text className="text-sm text-gray-500">
                {mode === 'AFTER_INVOICE'
                  ? 'Não há faturas depois desta.'
                  : 'Não há faturas para decidir.'}
              </Text>
            ) : (
              <View className="gap-3">
                {payments.map((payment) =>
                  payment.locked ? (
                    <LockedPaymentRow key={payment.id} payment={payment} />
                  ) : (
                    <PaymentDecisionRow
                      key={payment.id}
                      payment={payment}
                      decision={decisionOf(payment.id)}
                      onChange={(decision) =>
                        setOverrides((current) => ({
                          ...current,
                          [payment.id]: decision,
                        }))
                      }
                    />
                  ),
                )}
                {preview && preview.olderPaymentsCount > 0 ? (
                  <Text className="text-xs text-gray-400">
                    {plural(
                      preview.olderPaymentsCount,
                      'fatura mais antiga não aparece aqui e fica',
                      'faturas mais antigas não aparecem aqui e ficam',
                    )}{' '}
                    como {preview.olderPaymentsCount === 1 ? 'está' : 'estão'}.
                  </Text>
                ) : null}
              </View>
            )}
          </Card>
        ) : null}

        {/* 4) Resumo */}
        {target && preview ? (
          <EndSummary
            lessonsCancelled={preview.lessonsCancelled}
            lessonsKept={preview.lessonsKept}
            paymentsDeleted={toDelete.length}
            paymentsRefunded={refunded.length}
            paymentsMarkedPaid={toMarkPaid.length}
            endsAt={preview.endsAt}
          />
        ) : null}

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
