import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { History, Info, Trash2, UserMinus } from 'lucide-react-native';
import { api } from '../../lib/api';
import { confirmAsync } from '../../lib/confirm';
import { firstName } from '../../lib/name';
import {
  formatLessonShortDate,
  formatLessonTime,
} from '../../lib/lessonFormat';
import { formatCurrency, formatMonthLabel } from '../../lib/paymentFormat';
import { paymentStatusConfig } from '../../lib/status';
import {
  endEnrollment,
  fetchEndPreview,
  fetchUpcomingLessons,
  studentAdminKeys,
  useRefreshStudentData,
} from '../../lib/studentAdmin';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { OptionRow } from '../../components/form/OptionRow';
import { Badge } from '../../components/student/detail/Badge';
import type { EnrollmentSummary } from '../../components/student/detail/EnrollmentCard';

type StudentLite = { id: string; name: string };

// Escolha "encerrar a partir de agora" quando não há aulas futuras
const NOW = 'NOW';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function SummaryLine({
  icon: Icon,
  color,
  bg,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <Icon size={16} color={color} />
      </View>
      <Text className="flex-1 text-sm text-[#1A1A1A]">{children}</Text>
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
  const { data: upcoming, isLoading: loadingUpcoming } = useQuery({
    queryKey: studentAdminKeys.upcoming(enrollment?.id ?? ''),
    queryFn: () => fetchUpcomingLessons(enrollment!.id),
    enabled: !!enrollment,
  });

  const [picked, setPicked] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const lessons = upcoming ?? [];
  const hasLessons = lessons.length > 0;
  // Sem aulas futuras, a única opção é encerrar já (pré-selecionada)
  const selection = picked ?? (upcoming && !hasLessons ? NOW : null);
  const fromLessonId = selection && selection !== NOW ? selection : null;

  const { data: preview, isFetching: loadingPreview } = useQuery({
    queryKey: studentAdminKeys.endPreview(enrollment?.id ?? '', fromLessonId),
    queryFn: () => fetchEndPreview(enrollment!.id, fromLessonId),
    enabled: !!enrollment && !!selection,
  });

  const end = useMutation({
    mutationFn: () => endEnrollment(enrollment!.id, fromLessonId),
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

  async function handleEnd() {
    if (!preview || !student) return;
    setSubmitError(null);

    const ok = await confirmAsync({
      title: `Encerrar a matrícula de ${firstName(student.name)}?`,
      message: `${plural(preview.lessonsRemoved, 'aula será removida', 'aulas serão removidas')} e ${plural(preview.paymentsDeleted.length, 'fatura será apagada', 'faturas serão apagadas')}. As aulas anteriores ficam no histórico.\n\nNão dá para desfazer.`,
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
            disabled={!selection || !preview || loadingPreview}
            loading={end.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        <Card className="gap-4">
          <View>
            <Text
              className="text-lg"
              style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
            >
              {hasLessons
                ? 'A partir de qual aula?'
                : 'Encerrar a partir de agora'}
            </Text>
            <Text className="text-sm text-gray-500 mt-1">
              {hasLessons
                ? `Escolha a primeira aula que ${student ? firstName(student.name) : 'o aluno'} deixa de ter. Ela e as seguintes são removidas; as anteriores ficam no histórico.`
                : 'Não há aulas futuras agendadas. A matrícula será encerrada e nenhuma aula nova será criada.'}
            </Text>
          </View>

          {hasLessons && (
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
                  onPress={() => setPicked(lesson.id)}
                />
              ))}
            </View>
          )}
        </Card>

        {selection && (
          <Card className="gap-4">
            <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
              O que acontece
            </Text>

            {loadingPreview && !preview ? (
              <ActivityIndicator color="#B08D57" />
            ) : preview ? (
              <>
                <View className="gap-3">
                  <SummaryLine icon={Trash2} color="#DC2626" bg="#FEF2F2">
                    <Text className="font-semibold">
                      {plural(
                        preview.lessonsRemoved,
                        'aula removida',
                        'aulas removidas',
                      )}
                    </Text>{' '}
                    da agenda
                  </SummaryLine>
                  <SummaryLine icon={History} color="#B08D57" bg="#F3EADD">
                    <Text className="font-semibold">
                      {plural(preview.lessonsKept, 'aula fica', 'aulas ficam')}
                    </Text>{' '}
                    no histórico
                  </SummaryLine>
                </View>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(0,0,0,0.06)',
                  }}
                />

                <View className="gap-2.5">
                  <Text className="text-sm font-semibold text-[#1A1A1A]">
                    {preview.paymentsDeleted.length === 0
                      ? 'Nenhuma fatura será apagada'
                      : plural(
                          preview.paymentsDeleted.length,
                          'fatura em aberto será apagada',
                          'faturas em aberto serão apagadas',
                        )}
                  </Text>
                  {preview.paymentsDeleted.map((payment) => {
                    const cfg = paymentStatusConfig(payment.status);
                    return (
                      <View
                        key={payment.id}
                        className="flex-row items-center justify-between rounded-xl px-3 py-2.5"
                        style={{ backgroundColor: '#F5F1EA' }}
                      >
                        <View>
                          <Text className="text-sm font-medium">
                            {formatMonthLabel(payment.referenceMonth)}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            R$ {formatCurrency(payment.amount)}
                          </Text>
                        </View>
                        <Badge
                          label={cfg.label}
                          bg={cfg.colorBg}
                          color={cfg.colorText}
                        />
                      </View>
                    );
                  })}
                  <Text className="text-xs text-gray-500 leading-4">
                    Faturas de aulas que continuam no histórico são mantidas —
                    inclusive as atrasadas.
                  </Text>
                </View>

                {preview.paidPaymentsAffected.length > 0 && (
                  <View
                    className="flex-row gap-2 rounded-xl px-3 py-2.5"
                    style={{ backgroundColor: '#FFFBEB' }}
                  >
                    <Info size={15} color="#D97706" style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-xs text-[#92400E] leading-4">
                      {preview.paidPaymentsAffected.length === 1
                        ? `A fatura paga de ${formatMonthLabel(preview.paidPaymentsAffected[0].referenceMonth)} é mantida.`
                        : 'Faturas já pagas são mantidas.'}{' '}
                      O sistema não estorna pagamentos automaticamente.
                    </Text>
                  </View>
                )}
              </>
            ) : null}
          </Card>
        )}

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
