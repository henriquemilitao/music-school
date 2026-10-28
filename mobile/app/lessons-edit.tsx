import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { api } from '../lib/api';
import { confirmAsync } from '../lib/dialog';
import {
  bulkUpdateLessons,
  useRefreshLessons,
  useStudentLessons,
  useTeachers,
} from '../lib/lessonAdmin';
import {
  buildBulkChanges,
  commonWeekday,
  EMPTY_BULK_FORM,
  hasBulkChange,
  sameWeekShiftDays,
  shiftedDate,
  shiftTargetWeekday,
  validateBulkForm,
  type BulkEditForm,
} from '../lib/lessonForm';
import { formatLessonShortDate, formatLessonTime } from '../lib/lessonFormat';
import {
  CANCEL_REASON_MAX_LENGTH,
  type LessonStatus,
  type StudentLesson,
} from '../lib/lessonTypes';
import { firstName } from '../lib/name';
import { useUnsavedChangesGuard } from '../lib/useUnsavedChangesGuard';
import { WEEKDAY_NAMES, WEEKDAY_OPTIONS } from '../lib/weekdays';
import { ActionFooter } from '../components/ui/ActionFooter';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DetailScreen } from '../components/ui/DetailScreen';
import { ErrorRetry } from '../components/ui/ErrorRetry';
import { InlineFeedback } from '../components/ui/InlineFeedback';
import { ChoiceChips } from '../components/form/ChoiceChips';
import { FormField, TextField } from '../components/form/FormField';
import { Stepper } from '../components/form/Stepper';
import { TimeField } from '../components/form/TimeField';
import {
  LESSON_STATUS_CHOICES,
  LessonAssignmentFields,
  LessonNote,
} from '../components/lesson/LessonFormFields';

type StudentLite = { id: string; name: string; instrument: string | null };

const MAX_SHIFT = 366;
const PREVIEW_LIMIT = 4;

const STATUS_CHOICES: {
  value: LessonStatus | null;
  label: string;
  selectedColor?: string;
}[] = [{ value: null, label: 'Manter' }, ...LESSON_STATUS_CHOICES];

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

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

function shiftLabel(days: number) {
  if (days === 0) return 'Manter o dia';
  const abs = Math.abs(days);
  return `${days > 0 ? 'Daqui a' : 'Voltar'} ${plural(abs, 'dia', 'dias')}`;
}

// Prévia: cada aula escolhida (as primeiras) como fica depois da mudança
function SchedulePreview({
  lessons,
  form,
}: {
  lessons: StudentLesson[];
  form: BulkEditForm;
}) {
  const moves = form.shiftDays !== 0 || form.time !== '';
  if (!moves) return null;

  const shown = lessons.slice(0, PREVIEW_LIMIT);
  return (
    <View className="gap-2">
      {shown.map((lesson) => {
        const next = shiftedDate(lesson.scheduledAt, form.shiftDays, form.time);
        const nextIso = next.toISOString();
        return (
          <View key={lesson.id} className="flex-row items-center gap-2">
            <Text className="flex-1 text-xs text-gray-500">
              {formatLessonShortDate(lesson.scheduledAt)} ·{' '}
              {formatLessonTime(lesson.scheduledAt)}
            </Text>
            <ArrowRight size={13} color="#9CA3AF" />
            <Text className="flex-1 text-xs font-semibold">
              {formatLessonShortDate(nextIso)} · {formatLessonTime(nextIso)}
            </Text>
          </View>
        );
      })}
      {lessons.length > PREVIEW_LIMIT && (
        <Text className="text-xs text-gray-400">
          e mais {lessons.length - PREVIEW_LIMIT}{' '}
          {lessons.length - PREVIEW_LIMIT === 1 ? 'aula' : 'aulas'} com a mesma
          mudança
        </Text>
      )}
    </View>
  );
}

// Editar várias aulas de uma vez. Tudo começa em "Manter": só o que for
// escolhido muda, igual pra todas as aulas marcadas.
export default function EditLessonsInBulk() {
  const { studentId, ids } = useLocalSearchParams<{
    studentId: string;
    ids: string;
  }>();
  const router = useRouter();
  const refreshLessons = useRefreshLessons();

  const lessonIds = useMemo(
    () => (ids ?? '').split(',').filter(Boolean),
    [ids],
  );

  const studentQuery = useQuery({
    queryKey: ['admin-student', studentId],
    queryFn: async () =>
      (await api.get<StudentLite>(`/students/${studentId}`)).data,
    enabled: !!studentId,
  });
  const lessonsQuery = useStudentLessons(studentId);
  const teachers = useTeachers().data ?? [];

  // As aulas marcadas, em ordem de data
  const selected = useMemo(() => {
    const wanted = new Set(lessonIds);
    return (lessonsQuery.data ?? [])
      .filter((lesson) => wanted.has(lesson.id))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [lessonsQuery.data, lessonIds]);

  const [form, setForm] = useState<BulkEditForm>(EMPTY_BULK_FORM);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const changed = hasBulkChange(form);
  const guard = useUnsavedChangesGuard(changed);

  const apply = useMutation({
    mutationFn: () => bulkUpdateLessons(lessonIds, buildBulkChanges(form)),
    onSuccess: () => {
      refreshLessons(studentId, lessonIds);
      guard.allowLeave();
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível salvar. Tente novamente.',
      );
    },
  });

  function patch(next: Partial<BulkEditForm>) {
    setForm((current) => ({ ...current, ...next }));
    setSubmitError(null);
    if ('time' in next) setTimeError(undefined);
  }

  // "Agora" fixo desde que a tela abriu (decide se o dia escolhido já passou)
  const [openedAt] = useState(() => Date.now());

  // Só dá pra "passar tudo para quarta" quando todas são do mesmo dia da
  // semana. A 1ª aula (a mais antiga) é a base: o resto anda os mesmos dias.
  const weekday = commonWeekday(selected);
  const firstLessonIso = selected[0]?.scheduledAt;
  const shiftFor = (target: number, time: string) =>
    sameWeekShiftDays({
      firstLessonIso,
      targetWeekday: target,
      time,
      now: openedAt,
    });
  const targetWeekday =
    weekday !== null ? shiftTargetWeekday(weekday, form.shiftDays) : null;

  async function handleApply() {
    const errors = validateBulkForm(form);
    setTimeError(errors.time);
    if (errors.time) return;

    const lines: string[] = [];
    if (form.status)
      lines.push(
        `Situação: ${STATUS_CHOICES.find((c) => c.value === form.status)?.label}`,
      );
    if (form.shiftDays !== 0) lines.push(shiftLabel(form.shiftDays));
    if (form.time) lines.push(`Novo horário: ${form.time}`);
    if (form.durationMinutes)
      lines.push(`Duração: ${form.durationMinutes} min`);
    if (form.instrument) lines.push('Instrumento alterado');
    if (form.teacherId) lines.push('Professor alterado');

    const ok = await confirmAsync({
      title: `Alterar ${plural(selected.length, 'aula', 'aulas')}?`,
      message: `${lines.join('\n')}\n\nA mesma mudança vale para todas as aulas marcadas.`,
      confirmText: 'Alterar',
      destructive: form.status === 'CANCELLED',
    });
    if (ok) apply.mutate();
  }

  const loading = studentQuery.isLoading || lessonsQuery.isLoading;

  if (loading) {
    return (
      <DetailScreen title="Editar aulas">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (studentQuery.isError || lessonsQuery.isError || selected.length === 0) {
    return (
      <DetailScreen title="Editar aulas" contentPadding>
        <ErrorRetry
          message="Não foi possível carregar as aulas escolhidas."
          onRetry={() => {
            void studentQuery.refetch();
            void lessonsQuery.refetch();
          }}
        />
      </DetailScreen>
    );
  }

  const name = studentQuery.data
    ? firstName(studentQuery.data.name)
    : 'o aluno';

  return (
    <DetailScreen
      title={`Editar ${plural(selected.length, 'aula', 'aulas')}`}
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label={`Aplicar a ${plural(selected.length, 'aula', 'aulas')}`}
            icon={Check}
            onPress={() => void handleApply()}
            disabled={!changed}
            loading={apply.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        <LessonNote>
          Aulas de {name}. Tudo começa em “Manter”: só o que você escolher muda,
          e vale igual para todas as aulas marcadas.
        </LessonNote>

        <Card className="gap-5">
          <SectionTitle title="Situação" />
          <FormField label="Mudar para">
            <ChoiceChips
              options={STATUS_CHOICES}
              value={form.status}
              onChange={(status) => patch({ status })}
            />
          </FormField>
          {form.status === 'CANCELLED' && (
            <TextField
              label="Motivo do cancelamento"
              hint="Opcional"
              value={form.cancelReason}
              onChangeText={(cancelReason) => patch({ cancelReason })}
              placeholder="Ex: recesso, feriado"
              maxLength={CANCEL_REASON_MAX_LENGTH}
            />
          )}
        </Card>

        <Card className="gap-5">
          <SectionTitle
            title="Dia e horário"
            subtitle="O dia anda para frente ou para trás a partir da data de cada aula."
          />
          {weekday !== null && (
            <FormField
              label="Passar todas para"
              hint={`Hoje são aulas de ${WEEKDAY_NAMES[weekday].toLowerCase()}. Fica na mesma semana da primeira aula (${formatLessonShortDate(firstLessonIso)}); se o dia já passou, vai para a semana seguinte.`}
            >
              <ChoiceChips
                options={[
                  { value: null as number | null, label: 'Manter' },
                  ...WEEKDAY_OPTIONS.filter(
                    (option) => option.value !== weekday,
                  ).map((option) => ({
                    value: option.value as number | null,
                    label: option.label,
                  })),
                ]}
                value={targetWeekday}
                onChange={(target) =>
                  patch({
                    shiftDays:
                      target === null ? 0 : shiftFor(target, form.time),
                  })
                }
              />
            </FormField>
          )}
          <FormField
            label={weekday !== null ? 'Ou ajustar por dias' : 'Mover os dias'}
          >
            <Stepper
              value={form.shiftDays}
              onChange={(shiftDays) => patch({ shiftDays })}
              min={-MAX_SHIFT}
              max={MAX_SHIFT}
              format={shiftLabel}
              decrementLabel="Voltar um dia"
              incrementLabel="Avançar um dia"
            />
          </FormField>
          <TimeField
            label="Novo horário"
            hint="Deixe em branco para manter o horário de cada aula."
            value={form.time}
            onChange={(time) => {
              // Mudar o horário pode fazer o dia escolhido já ter passado
              // (ou deixar de ter): recalcula enquanto os dias não foram
              // ajustados à mão.
              const followsWeekday =
                targetWeekday !== null &&
                form.shiftDays === shiftFor(targetWeekday, form.time);
              patch({
                time,
                ...(followsWeekday
                  ? { shiftDays: shiftFor(targetWeekday, time) }
                  : {}),
              });
            }}
            error={timeError}
          />
          <SchedulePreview lessons={selected} form={form} />
        </Card>

        <Card className="gap-5">
          <SectionTitle title="Detalhes da aula" />
          <LessonAssignmentFields
            allowKeep
            durationMinutes={form.durationMinutes}
            instrument={form.instrument}
            teacherId={form.teacherId}
            teachers={teachers}
            onChange={(next) => patch(next as Partial<BulkEditForm>)}
          />
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
