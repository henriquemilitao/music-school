import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { formatInstrument } from '../../lib/instrument';
import {
  buildLessonPatch,
  isLessonFormDirty,
  lessonToForm,
  rescheduledStatus,
  validateLessonForm,
  type LessonForm,
  type LessonFormErrors,
} from '../../lib/lessonForm';
import {
  updateLesson,
  useAdminLesson,
  useRefreshLessons,
  useTeachers,
} from '../../lib/lessonAdmin';
import { formatLessonFullDate } from '../../lib/lessonFormat';
import { adminLessonKeys } from '../../lib/queryKeys';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import {
  LessonAssignmentFields,
  LessonStatusFields,
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

// Editar UMA aula: situação, data, horário, duração, instrumento e professor.
// Só o que mudou é enviado. Uma aula cancelada que ganha data futura volta
// sozinha para "Agendada" (é assim que se reagenda).
export default function EditLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const refreshLessons = useRefreshLessons();

  const lessonQuery = useAdminLesson(id);
  const lesson = lessonQuery.data;
  const teachers = useTeachers().data ?? [];

  const studentInstrument = lesson?.student.instrument ?? null;
  const initial = useMemo(
    () => (lesson ? lessonToForm(lesson, studentInstrument) : null),
    [lesson, studentInstrument],
  );

  // Só guardamos o que foi mexido; o resto vem da aula atual.
  const [draft, setDraft] = useState<Partial<LessonForm>>({});
  const [errors, setErrors] = useState<LessonFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  // "Agora" fixo desde que a tela abriu: só decide se a nova data é futura
  const [openedAt] = useState(() => Date.now());
  const autoStatus = initial
    ? rescheduledStatus(initial, draft, openedAt)
    : null;

  const form: LessonForm | null = useMemo(
    () =>
      initial
        ? {
            ...initial,
            ...draft,
            ...(autoStatus ? { status: autoStatus } : {}),
          }
        : null,
    [initial, draft, autoStatus],
  );
  const dirty = !!initial && !!form && isLessonFormDirty(initial, form);
  const guard = useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: () => {
      const patch = buildLessonPatch(
        lesson!,
        initial!,
        form!,
        studentInstrument,
      );
      return updateLesson(id, patch);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(adminLessonKeys.detail(id), updated);
      refreshLessons(updated.studentId, [id]);
      guard.allowLeave();
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível salvar. Tente novamente.',
      );
    },
  });

  function patch(next: Partial<LessonForm>) {
    setDraft((current) => ({ ...current, ...next }));
    setSubmitError(null);
    // limpa o erro dos campos que acabaram de ser mexidos
    setErrors((current) => {
      const cleared = { ...current };
      (Object.keys(next) as (keyof LessonForm)[]).forEach((key) => {
        if (key === 'date' || key === 'time') delete cleared[key];
        if (key === 'durationMinutes') delete cleared.durationMinutes;
        if (key === 'cancelReason') delete cleared.cancelReason;
      });
      return cleared;
    });
  }

  function handleSave() {
    if (!form) return;
    const found = validateLessonForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate();
  }

  if (lessonQuery.isLoading) {
    return (
      <DetailScreen title="Editar aula">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (lessonQuery.isError || !lesson || !form || !initial) {
    return (
      <DetailScreen title="Editar aula" contentPadding>
        <ErrorRetry
          message="Não foi possível carregar essa aula."
          onRetry={() => void lessonQuery.refetch()}
          retrying={lessonQuery.isFetching}
        />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      title="Editar aula"
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label="Salvar alterações"
            icon={Check}
            onPress={handleSave}
            disabled={!dirty}
            loading={save.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        {Object.keys(errors).length > 0 && (
          <InlineFeedback
            type="error"
            message="Confira os campos destacados para continuar."
          />
        )}

        <View className="px-1">
          <Text className="text-sm font-semibold">{lesson.student.name}</Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            {formatLessonFullDate(lesson.scheduledAt)} ·{' '}
            {formatInstrument(lesson.instrument ?? lesson.student.instrument)}
          </Text>
        </View>

        <Card className="gap-5">
          <SectionTitle title="Situação" />
          <LessonStatusFields
            status={form.status}
            cancelReason={form.cancelReason}
            date={form.date}
            time={form.time}
            error={errors.cancelReason}
            rescheduled={!!autoStatus}
            onChange={patch}
          />
        </Card>

        <Card className="gap-5">
          <SectionTitle
            title="Dia e horário"
            subtitle="Mudar aqui leva só esta aula para outra data."
          />
          <LessonWhenFields
            date={form.date}
            time={form.time}
            errors={errors}
            onChange={patch}
          />
        </Card>

        <Card className="gap-5">
          <SectionTitle title="Detalhes da aula" />
          <LessonAssignmentFields
            durationMinutes={form.durationMinutes}
            instrument={form.instrument}
            teacherId={form.teacherId}
            teachers={teachers}
            durationError={errors.durationMinutes}
            onChange={(next) => patch(next as Partial<LessonForm>)}
          />
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
