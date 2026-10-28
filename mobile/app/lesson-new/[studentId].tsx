import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Info } from 'lucide-react-native';
import { api } from '../../lib/api';
import {
  buildCreateBody,
  newLessonForm,
  validateLessonForm,
  type LessonForm,
  type LessonFormErrors,
} from '../../lib/lessonForm';
import {
  createLesson,
  useRefreshLessons,
  useTeachers,
} from '../../lib/lessonAdmin';
import { firstName } from '../../lib/name';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import {
  LessonAssignmentFields,
  LessonWhenFields,
} from '../../components/lesson/LessonFormFields';
import type { EnrollmentSummary } from '../../components/student/detail/EnrollmentCard';

type StudentLite = { id: string; name: string; instrument: string | null };

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

// Criar uma aula a mais. Já vem preenchida com o que se sabe do aluno
// (instrumento, professor, duração); dia e horário ficam em branco de
// propósito, pois são obrigatórios.
export default function NewLesson() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const router = useRouter();
  const refreshLessons = useRefreshLessons();

  const studentQuery = useQuery({
    queryKey: ['admin-student', studentId],
    queryFn: async () =>
      (await api.get<StudentLite>(`/students/${studentId}`)).data,
    enabled: !!studentId,
  });
  const enrollmentQuery = useQuery({
    queryKey: ['admin-student-enrollment', studentId],
    queryFn: async () =>
      (
        await api.get<EnrollmentSummary | null>(
          `/enrollments/student/${studentId}`,
        )
      ).data,
    enabled: !!studentId,
  });
  const teachers = useTeachers().data ?? [];

  const student = studentQuery.data;
  const enrollment = enrollmentQuery.data;
  const ready = !!student && enrollmentQuery.isSuccess;

  const initial = useMemo(
    () =>
      ready
        ? newLessonForm({
            instrument: student.instrument,
            teacherId: enrollment?.teacherId ?? null,
            durationMinutes: enrollment?.durationMinutes ?? 60,
          })
        : null,
    [ready, student, enrollment],
  );

  const [draft, setDraft] = useState<Partial<LessonForm>>({});
  const [errors, setErrors] = useState<LessonFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form: LessonForm | null = useMemo(
    () => (initial ? { ...initial, ...draft } : null),
    [initial, draft],
  );
  const dirty = Object.keys(draft).length > 0;
  const guard = useUnsavedChangesGuard(dirty);

  const create = useMutation({
    mutationFn: () => {
      const body = buildCreateBody(form!, {
        studentId,
        enrollmentId: enrollment?.id ?? null,
        studentInstrument: student!.instrument,
      });
      if (!body) throw new Error('Dados da aula inválidos');
      return createLesson(body);
    },
    onSuccess: (created) => {
      refreshLessons(studentId, [created.id]);
      guard.allowLeave();
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ??
          'Não foi possível criar a aula. Tente novamente.',
      );
    },
  });

  function patch(next: Partial<LessonForm>) {
    setDraft((current) => ({ ...current, ...next }));
    setSubmitError(null);
    setErrors((current) => {
      const cleared = { ...current };
      if ('date' in next) delete cleared.date;
      if ('time' in next) delete cleared.time;
      if ('durationMinutes' in next) delete cleared.durationMinutes;
      return cleared;
    });
  }

  function handleCreate() {
    if (!form) return;
    const found = validateLessonForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate();
  }

  const title = 'Nova aula';

  if (studentQuery.isLoading || enrollmentQuery.isLoading) {
    return (
      <DetailScreen title={title}>
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!student || !form || enrollmentQuery.isError) {
    return (
      <DetailScreen title={title} contentPadding>
        <ErrorRetry
          message="Não foi possível carregar os dados do aluno."
          onRetry={() => {
            void studentQuery.refetch();
            void enrollmentQuery.refetch();
          }}
        />
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      title={title}
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label="Criar aula"
            icon={Check}
            onPress={handleCreate}
            loading={create.isPending}
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

        <View
          className="flex-row gap-2 rounded-xl px-3 py-2.5"
          style={{ backgroundColor: '#F3EADD' }}
        >
          <Info size={15} color="#B08D57" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-[#6B5B3E] leading-4">
            Aula de {firstName(student.name)}. Já preenchemos com os dados da
            matrícula; só falta escolher o dia e o horário.
          </Text>
        </View>

        <Card className="gap-5">
          <SectionTitle title="Dia e horário" />
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
