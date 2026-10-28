import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarX2 } from 'lucide-react-native';
import { formatInstrument } from '../../lib/instrument';
import {
  buildCancelBody,
  makeupDraftFrom,
  validateMakeupDraft,
  type MakeupDraft,
} from '../../lib/lessonForm';
import {
  cancelLesson,
  useAdminLesson,
  useRefreshLessons,
  useTeachers,
} from '../../lib/lessonAdmin';
import {
  formatLessonFullDate,
  formatLessonTimeRange,
} from '../../lib/lessonFormat';
import { CANCEL_REASON_MAX_LENGTH } from '../../lib/lessonTypes';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { OptionRow } from '../../components/form/OptionRow';
import { TextField } from '../../components/form/FormField';
import {
  LessonAssignmentFields,
  LessonNote,
  LessonWhenFields,
} from '../../components/lesson/LessonFormFields';

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

// Cancelar uma aula. Dá pra já marcar a reposição (a aula nova nasce ligada a
// esta) ou deixar "sem reposição prevista" e marcar depois.
export default function CancelLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refreshLessons = useRefreshLessons();

  const lessonQuery = useAdminLesson(id);
  const lesson = lessonQuery.data;
  const teachers = useTeachers().data ?? [];
  const studentInstrument = lesson?.student.instrument ?? null;

  const [reason, setReason] = useState('');
  const [withMakeup, setWithMakeup] = useState(false);
  const [draftOverrides, setDraftOverrides] = useState<Partial<MakeupDraft>>(
    {},
  );
  const [errors, setErrors] = useState<{ date?: string; time?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const baseDraft = useMemo(
    () => (lesson ? makeupDraftFrom(lesson, studentInstrument) : null),
    [lesson, studentInstrument],
  );
  const draft: MakeupDraft | null = baseDraft
    ? { ...baseDraft, ...draftOverrides }
    : null;

  const cancel = useMutation({
    mutationFn: () =>
      cancelLesson(
        id,
        buildCancelBody(
          reason,
          withMakeup ? draft : null,
          lesson!,
          studentInstrument,
        ),
      ),
    onSuccess: (result) => {
      refreshLessons(
        lesson!.studentId,
        [id, result.makeup?.id].filter((x): x is string => !!x),
      );
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível cancelar. Tente novamente.',
      );
    },
  });

  function patchDraft(next: Partial<MakeupDraft>) {
    setDraftOverrides((current) => ({ ...current, ...next }));
    setSubmitError(null);
    setErrors((current) => {
      const cleared = { ...current };
      if ('date' in next) delete cleared.date;
      if ('time' in next) delete cleared.time;
      return cleared;
    });
  }

  function handleCancel() {
    if (withMakeup && draft) {
      const found = validateMakeupDraft(draft);
      setErrors(found);
      if (Object.keys(found).length > 0) return;
    }
    cancel.mutate();
  }

  if (lessonQuery.isLoading) {
    return (
      <DetailScreen title="Cancelar aula">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (lessonQuery.isError || !lesson || !draft) {
    return (
      <DetailScreen title="Cancelar aula" contentPadding>
        <ErrorRetry
          message="Não foi possível carregar essa aula."
          onRetry={() => void lessonQuery.refetch()}
          retrying={lessonQuery.isFetching}
        />
      </DetailScreen>
    );
  }

  if (lesson.status === 'CANCELLED') {
    return (
      <DetailScreen title="Cancelar aula" contentPadding>
        <Card>
          <Text className="text-sm text-gray-500 text-center">
            Esta aula já está cancelada. Para marcar a reposição, abra a aula e
            use “Marcar reposição”.
          </Text>
        </Card>
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      title="Cancelar aula"
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label={withMakeup ? 'Cancelar e marcar reposição' : 'Cancelar aula'}
            variant="danger"
            icon={CalendarX2}
            onPress={handleCancel}
            loading={cancel.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        <Card className="gap-1">
          <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
            Aula que será cancelada
          </Text>
          <Text className="text-base font-semibold mt-1">
            {lesson.student.name}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatLessonFullDate(lesson.scheduledAt)}
          </Text>
          <Text className="text-sm text-gray-500">
            {formatLessonTimeRange(lesson.scheduledAt, lesson.durationMinutes)}{' '}
            · {formatInstrument(lesson.instrument ?? lesson.student.instrument)}
          </Text>
        </Card>

        <Card className="gap-4">
          <SectionTitle title="E a reposição?" />
          <View className="gap-2.5" accessibilityRole="radiogroup">
            <OptionRow
              selected={!withMakeup}
              title="Sem reposição por enquanto"
              subtitle="A aula fica como “sem reposição prevista”. Você pode marcar depois."
              onPress={() => setWithMakeup(false)}
            />
            <OptionRow
              selected={withMakeup}
              title="Já marcar a reposição"
              subtitle="Cria uma aula nova ligada a esta, já agendada."
              onPress={() => setWithMakeup(true)}
            />
          </View>
        </Card>

        {withMakeup && (
          <Card className="gap-5">
            <SectionTitle
              title="Aula de reposição"
              subtitle="Já vem com os dados desta aula. Escolha o dia e, se precisar, ajuste o resto."
            />
            <LessonWhenFields
              date={draft.date}
              time={draft.time}
              errors={errors}
              onChange={patchDraft}
              dateLabel="Dia da reposição"
              timeLabel="Horário da reposição"
            />
            <LessonAssignmentFields
              durationMinutes={draft.durationMinutes}
              instrument={draft.instrument}
              teacherId={draft.teacherId}
              teachers={teachers}
              onChange={(next) => patchDraft(next as Partial<MakeupDraft>)}
            />
            <LessonNote>
              Se esse dia já passou, a reposição é marcada como realizada
              automaticamente em poucos minutos.
            </LessonNote>
          </Card>
        )}

        <Card className="gap-4">
          <TextField
            label="Motivo do cancelamento"
            hint="Opcional"
            value={reason}
            onChangeText={setReason}
            placeholder="Ex: aluno doente, feriado"
            maxLength={CANCEL_REASON_MAX_LENGTH}
          />
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
