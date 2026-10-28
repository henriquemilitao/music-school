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
import {
  endEnrollment,
  fetchEndPreview,
  fetchUpcomingLessons,
  studentAdminKeys,
  useRefreshStudentData,
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
import { EndSummary } from '../../components/student/end/EndSummary';
import { PaymentDecisionRow } from '../../components/student/end/PaymentDecisionRow';

type StudentLite = { id: string; name: string };

// Sem aulas futuras não há o que escolher: encerra "agora"
const NOW = 'NOW';

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
  const {
    data: upcoming,
    isLoading: loadingUpcoming,
    isError: upcomingFailed,
    isFetching: fetchingUpcoming,
    refetch: refetchUpcoming,
  } = useQuery({
    queryKey: studentAdminKeys.upcoming(enrollment?.id ?? ''),
    queryFn: () => fetchUpcomingLessons(enrollment!.id),
    enabled: !!enrollment,
  });

  const [picked, setPicked] = useState<string | null>(null);
  // Só guardamos o que o admin mexeu; o resto segue a sugestão do servidor
  const [overrides, setOverrides] = useState<Record<string, PaymentDecision>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lessons = upcoming ?? [];
  const hasLessons = lessons.length > 0;
  const selection = picked ?? (upcoming && !hasLessons ? NOW : null);
  const fromLessonId = selection && selection !== NOW ? selection : null;

  const {
    data: preview,
    isLoading: loadingPreview,
    isError: previewFailed,
    isFetching: fetchingPreview,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: studentAdminKeys.endPreview(enrollment?.id ?? '', fromLessonId),
    queryFn: () => fetchEndPreview(enrollment!.id, fromLessonId),
    enabled: !!enrollment && !!selection,
  });

  const decisionOf = (paymentId: string, suggestion: PaymentDecision) =>
    overrides[paymentId] ?? suggestion;

  const payments = preview?.payments ?? [];
  const toDelete = payments.filter(
    (p) => decisionOf(p.id, p.suggestion) === 'DELETE',
  );
  const refunded = toDelete.filter((p) => p.status === 'PAID');

  const end = useMutation({
    mutationFn: () =>
      endEnrollment(enrollment!.id, {
        ...(fromLessonId ? { fromLessonId } : {}),
        deletePaymentIds: toDelete.map((p) => p.id),
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

  function pickLesson(lessonId: string) {
    setPicked(lessonId);
    // Outra aula de corte muda as sugestões: recomeça das sugestões
    setOverrides({});
    setSubmitError(null);
  }

  async function handleEnd() {
    if (!preview || !student) return;
    setSubmitError(null);

    const refundNote =
      refunded.length > 0
        ? ` (${plural(refunded.length, 'já paga, será estornada', 'já pagas, serão estornadas')})`
        : '';
    const ok = await confirmAsync({
      title: `Encerrar a matrícula de ${firstName(student.name)}?`,
      message: `${plural(preview.lessonsCancelled, 'aula será cancelada', 'aulas serão canceladas')} e ${plural(toDelete.length, 'fatura será apagada', 'faturas serão apagadas')}${refundNote}. O aluno ficará inativo.\n\nNão dá para desfazer.`,
      confirmText: 'Encerrar matrícula',
      destructive: true,
    });
    if (ok) end.mutate();
  }

  if (loadingEnrollment || (enrollment && loadingUpcoming)) {
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
            disabled={!selection || !preview || fetchingPreview}
            loading={end.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        {/* 1) A partir de qual aula */}
        <Card className="gap-4">
          {upcomingFailed ? (
            <ErrorRetry
              message="Não foi possível carregar as aulas agendadas."
              onRetry={() => void refetchUpcoming()}
              retrying={fetchingUpcoming}
            />
          ) : hasLessons ? (
            <>
              <SectionTitle
                title="A partir de qual aula?"
                subtitle={`A aula escolhida e todas as seguintes serão canceladas e ficam no histórico como canceladas. As anteriores não mudam.`}
              />
              <View className="gap-2.5">
                {lessons.map((lesson, index) => (
                  <OptionRow
                    key={lesson.id}
                    selected={lesson.id === selection}
                    title={`${formatLessonShortDate(lesson.scheduledAt)} · ${formatLessonTime(lesson.scheduledAt)}`}
                    subtitle={
                      lesson.isMakeup
                        ? 'Reposição'
                        : index === 0
                          ? 'Próxima aula'
                          : undefined
                    }
                    onPress={() => pickLesson(lesson.id)}
                  />
                ))}
              </View>
            </>
          ) : (
            <SectionTitle
              title="Encerrar a partir de agora"
              subtitle={`Não há aulas futuras agendadas para ${name}. A matrícula será encerrada e nenhuma aula nova será criada.`}
            />
          )}
        </Card>

        {/* 2) Faturas: o admin decide uma a uma */}
        {selection ? (
          <Card className="gap-4">
            <SectionTitle
              title="O que fazer com as faturas?"
              subtitle="Escolha o que fica e o que sai. Nada é apagado sem você marcar."
            />

            {previewFailed ? (
              <ErrorRetry
                message="Não foi possível carregar as faturas."
                onRetry={() => void refetchPreview()}
                retrying={fetchingPreview}
              />
            ) : loadingPreview ? (
              <ActivityIndicator color="#B08D57" />
            ) : payments.length === 0 ? (
              <Text className="text-sm text-gray-500">
                Não há faturas em aberto nem pagas para decidir.
              </Text>
            ) : (
              <View className="gap-3">
                {payments.map((payment) => (
                  <PaymentDecisionRow
                    key={payment.id}
                    payment={payment}
                    decision={decisionOf(payment.id, payment.suggestion)}
                    onChange={(decision) =>
                      setOverrides((current) => ({
                        ...current,
                        [payment.id]: decision,
                      }))
                    }
                  />
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {/* 3) Resumo */}
        {preview ? (
          <EndSummary
            lessonsCancelled={preview.lessonsCancelled}
            lessonsKept={preview.lessonsKept}
            paymentsDeleted={toDelete.length}
            paymentsRefunded={refunded.length}
          />
        ) : null}

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
