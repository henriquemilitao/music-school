import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check, Info } from 'lucide-react-native';
import { api } from '../../lib/api';
import { confirmAsync } from '../../lib/confirm';
import {
  buildUpdateBody,
  dueDayDistance,
  DUE_DAY_CONFIRM_THRESHOLD,
  hasScheduleChange,
  initialEditForm,
  isEditFormDirty,
  validateEditForm,
  type EditFormErrors,
  type EnrollmentEditForm,
} from '../../lib/enrollmentEdit';
import { firstName } from '../../lib/name';
import { INSTRUMENT_OPTIONS } from '../../lib/instrument';
import {
  formatLessonShortDate,
  formatLessonTime,
} from '../../lib/lessonFormat';
import {
  DURATION_OPTIONS,
  formatMoneyDigits,
  maskMoneyDigits,
  maskTime,
} from '../../lib/newStudent';
import {
  fetchSchedulePreview,
  fetchUpcomingLessons,
  studentAdminKeys,
  updateEnrollment,
  useRefreshStudentData,
  type ScheduleChange,
} from '../../lib/studentAdmin';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { WEEKDAY_NAMES, WEEKDAY_OPTIONS } from '../../lib/weekdays';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { ErrorRetry } from '../../components/ui/ErrorRetry';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { ChoiceChips } from '../../components/form/ChoiceChips';
import { DayOfMonthPicker } from '../../components/form/DayOfMonthPicker';
import { FormField, TextField } from '../../components/form/FormField';
import { OptionRow } from '../../components/form/OptionRow';
import type { EnrollmentSummary } from '../../components/student/detail/EnrollmentCard';

type StudentLite = { id: string; name: string; instrument: string | null };
type TeacherOption = { id: string; user: { name: string } };

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

// Aviso discreto dentro do cartão (azul-acinzentado, não é erro)
function Note({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="flex-row gap-2 rounded-xl px-3 py-2.5"
      style={{ backgroundColor: '#F3EADD' }}
    >
      <Info size={15} color="#B08D57" style={{ marginTop: 1 }} />
      <Text className="flex-1 text-xs text-[#6B5B3E] leading-4">
        {children}
      </Text>
    </View>
  );
}

export default function EditEnrollment() {
  // O id da rota é o do ALUNO (mesma rota de student/[id])
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refreshStudent = useRefreshStudentData();

  const { data: student, isLoading: loadingStudent } = useQuery({
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
  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => (await api.get<TeacherOption[]>('/teachers')).data,
  });

  const initial = useMemo(
    () =>
      enrollment && student
        ? initialEditForm(enrollment, student.instrument)
        : null,
    [enrollment, student],
  );

  // Só guardamos o que foi mexido; o resto vem da matrícula atual.
  const [draft, setDraft] = useState<Partial<EnrollmentEditForm>>({});
  const [errors, setErrors] = useState<EditFormErrors>({});
  const [step, setStep] = useState<'form' | 'lessons'>('form');
  const [pickedLessonId, setPickedLessonId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form: EnrollmentEditForm | null = useMemo(
    () => (initial ? { ...initial, ...draft } : null),
    [initial, draft],
  );
  const dirty = !!initial && !!form && isEditFormDirty(initial, form);
  const scheduleChanged =
    !!initial && !!form && hasScheduleChange(initial, form);

  const changedSchedule: ScheduleChange = useMemo(() => {
    if (!initial || !form) return {};
    const change: ScheduleChange = {};
    if (form.weekDay !== initial.weekDay) change.weekDay = form.weekDay;
    if (form.startTime !== initial.startTime) change.startTime = form.startTime;
    if (form.durationMinutes !== initial.durationMinutes)
      change.durationMinutes = form.durationMinutes;
    return change;
  }, [initial, form]);

  // ── Etapa 2: aulas futuras (só carrega quando precisa) ──
  const {
    data: upcoming,
    isLoading: loadingUpcoming,
    isError: upcomingFailed,
    isFetching: fetchingUpcoming,
    refetch: refetchUpcoming,
  } = useQuery({
    queryKey: studentAdminKeys.upcoming(enrollment?.id ?? ''),
    queryFn: () => fetchUpcomingLessons(enrollment!.id),
    enabled: !!enrollment && step === 'lessons',
  });
  // Reposições são pontuais e não mudam de dia — ficam fora da escolha
  const regularLessons = (upcoming ?? []).filter((l) => !l.isMakeup);
  const selectedLessonId = pickedLessonId ?? regularLessons[0]?.id ?? null;

  const { data: preview, isFetching: loadingPreview } = useQuery({
    queryKey: studentAdminKeys.schedulePreview(
      enrollment?.id ?? '',
      selectedLessonId ?? '',
      changedSchedule,
    ),
    queryFn: () =>
      fetchSchedulePreview(enrollment!.id, selectedLessonId!, changedSchedule),
    enabled: !!enrollment && step === 'lessons' && !!selectedLessonId,
  });

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof buildUpdateBody>) =>
      updateEnrollment(enrollment!.id, body),
    onSuccess: () => {
      refreshStudent(id);
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível salvar. Tente novamente.',
      );
    },
  });

  useUnsavedChangesGuard(dirty && !save.isPending && !save.isSuccess);

  function patch(change: Partial<EnrollmentEditForm>) {
    setDraft((current) => ({ ...current, ...change }));
    setSubmitError(null);
    setErrors({});
  }

  // Envia de fato. Mudança grande no vencimento pede um "tem certeza?".
  async function submit(applyFromLessonId?: string) {
    if (!initial || !form) return;

    const distance = dueDayDistance(initial, form);
    if (distance > DUE_DAY_CONFIRM_THRESHOLD) {
      const ok = await confirmAsync({
        title: 'Mudar o vencimento?',
        message: `O vencimento vai do dia ${initial.dueDay} para o dia ${form.dueDay} (${distance} dias de diferença).\n\nFaturas já geradas continuam como estão; as próximas seguem o novo dia.`,
        confirmText: 'Sim, mudar',
      });
      if (!ok) return;
    }

    setSubmitError(null);
    save.mutate(buildUpdateBody(initial, form, applyFromLessonId));
  }

  function handleSavePress() {
    if (!form) return;
    const found = validateEditForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // Horário mudou → antes de salvar, escolher a partir de qual aula vale
    if (scheduleChanged) {
      setStep('lessons');
      return;
    }
    void submit();
  }

  function handleBack() {
    if (step === 'lessons') {
      setStep('form');
      return;
    }
    router.back();
  }

  if (loadingStudent || loadingEnrollment) {
    return (
      <DetailScreen title="Editar matrícula">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  if (!form || !initial || !enrollment) {
    return (
      <DetailScreen title="Editar matrícula">
        <View className="py-20 px-8 items-center">
          <Text className="text-sm text-gray-500 text-center">
            Este aluno não tem matrícula ativa para editar.
          </Text>
        </View>
      </DetailScreen>
    );
  }

  const newScheduleLabel = `${WEEKDAY_NAMES[form.weekDay]} às ${form.startTime} · ${form.durationMinutes} min`;

  // ───────────── Etapa 2: a partir de qual aula? ─────────────
  if (step === 'lessons') {
    const hasLessons = regularLessons.length > 0;
    const previewRows = preview?.lessons.slice(0, 3) ?? [];

    return (
      <DetailScreen
        title="A partir de qual aula?"
        onBack={handleBack}
        contentPadding
        footer={
          <ActionFooter>
            <Button
              label="Voltar"
              variant="secondary"
              onPress={handleBack}
              disabled={save.isPending}
              grow={false}
            />
            <Button
              label="Aplicar e salvar"
              icon={Check}
              onPress={() => void submit(selectedLessonId ?? undefined)}
              loading={save.isPending}
              disabled={
                loadingUpcoming ||
                upcomingFailed ||
                (hasLessons && !selectedLessonId)
              }
            />
          </ActionFooter>
        }
      >
        <View className="gap-4">
          <Card className="gap-4">
            <SectionTitle
              title={`Novo horário: ${newScheduleLabel}`}
              subtitle={`Escolha a primeira aula que passa para o novo horário. As aulas anteriores continuam como estão.${
                form.durationMinutes !== initial.durationMinutes
                  ? ` A duração passa de ${initial.durationMinutes} para ${form.durationMinutes} min.`
                  : ''
              }`}
            />

            {loadingUpcoming ? (
              <ActivityIndicator color="#B08D57" />
            ) : upcomingFailed ? (
              <ErrorRetry
                message="Não foi possível carregar as aulas agendadas."
                onRetry={() => void refetchUpcoming()}
                retrying={fetchingUpcoming}
              />
            ) : !hasLessons ? (
              <Note>
                Não há aulas futuras agendadas. O novo horário vale para as
                próximas aulas que forem geradas.
              </Note>
            ) : (
              <View className="gap-2.5">
                {regularLessons.map((lesson, index) => (
                  <OptionRow
                    key={lesson.id}
                    selected={lesson.id === selectedLessonId}
                    title={`${formatLessonShortDate(lesson.scheduledAt)} · ${formatLessonTime(lesson.scheduledAt)}`}
                    subtitle={index === 0 ? 'Próxima aula' : undefined}
                    onPress={() => setPickedLessonId(lesson.id)}
                  />
                ))}
              </View>
            )}
          </Card>

          {hasLessons && selectedLessonId && (
            <Card className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
                Como vai ficar
              </Text>
              {loadingPreview && !preview ? (
                <ActivityIndicator color="#B08D57" />
              ) : (
                <>
                  {previewRows.map((row) => {
                    const durationChanged =
                      row.fromDurationMinutes !== row.toDurationMinutes;
                    return (
                      <View
                        key={row.lessonId}
                        className="flex-row items-start gap-2"
                      >
                        <View className="flex-1">
                          <Text className="text-[13px] text-gray-500">
                            {formatLessonShortDate(row.from)} ·{' '}
                            {formatLessonTime(row.from)}
                          </Text>
                          {durationChanged && (
                            <Text className="text-xs text-gray-400 mt-0.5">
                              {row.fromDurationMinutes} min
                            </Text>
                          )}
                        </View>
                        <ArrowRight
                          size={14}
                          color="#B08D57"
                          style={{ marginTop: 2 }}
                        />
                        <View className="flex-1">
                          <Text className="text-[13px] font-semibold text-[#1A1A1A]">
                            {formatLessonShortDate(row.to)} ·{' '}
                            {formatLessonTime(row.to)}
                          </Text>
                          {durationChanged && (
                            <Text className="text-xs font-semibold text-[#B08D57] mt-0.5">
                              {row.toDurationMinutes} min
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                  {preview && preview.total > previewRows.length && (
                    <Text className="text-xs text-gray-400">
                      e mais {preview.total - previewRows.length}{' '}
                      {preview.total - previewRows.length === 1
                        ? 'aula'
                        : 'aulas'}
                      …
                    </Text>
                  )}
                </>
              )}
            </Card>
          )}

          <InlineFeedback type="error" message={submitError} />
        </View>
      </DetailScreen>
    );
  }

  // ───────────── Etapa 1: formulário ─────────────
  const teacherChanged = form.teacherId !== initial.teacherId;

  return (
    <DetailScreen
      title="Editar matrícula"
      onBack={handleBack}
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label={scheduleChanged ? 'Continuar' : 'Salvar alterações'}
            icon={scheduleChanged ? ArrowRight : Check}
            onPress={handleSavePress}
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

        <Card className="gap-5">
          <SectionTitle
            title="Instrumento e professor"
            subtitle={student ? firstName(student.name) : undefined}
          />
          <FormField label="Instrumento">
            <ChoiceChips
              options={INSTRUMENT_OPTIONS}
              value={form.instrument}
              onChange={(instrument) => patch({ instrument })}
            />
          </FormField>
          {teachers.length > 0 && (
            <FormField label="Professor">
              <ChoiceChips
                options={teachers.map((t) => ({
                  value: t.id as string | null,
                  label: firstName(t.user.name),
                }))}
                value={form.teacherId}
                onChange={(teacherId) => patch({ teacherId })}
              />
            </FormField>
          )}
          {teacherChanged && (
            <Note>
              As aulas futuras agendadas também passam para o novo professor.
            </Note>
          )}
        </Card>

        <Card className="gap-5">
          <SectionTitle title="Horário das aulas" />
          <FormField label="Dia da semana">
            <ChoiceChips
              options={WEEKDAY_OPTIONS}
              value={form.weekDay}
              onChange={(weekDay) => patch({ weekDay })}
            />
          </FormField>
          <TextField
            label="Horário"
            required
            value={form.startTime}
            onChangeText={(text) => patch({ startTime: maskTime(text) })}
            error={errors.startTime}
            placeholder="15:00"
            keyboardType="number-pad"
            maxLength={5}
          />
          <FormField label="Duração da aula">
            <ChoiceChips
              options={DURATION_OPTIONS.map((minutes) => ({
                value: minutes as number,
                label: `${minutes} min`,
              }))}
              value={form.durationMinutes}
              onChange={(durationMinutes) => patch({ durationMinutes })}
            />
          </FormField>
          {scheduleChanged && (
            <Note>
              Ao continuar, você escolhe a partir de qual aula o novo horário
              vale. As aulas anteriores não mudam.
            </Note>
          )}
        </Card>

        <Card className="gap-5">
          <SectionTitle title="Mensalidade" />
          <TextField
            label="Valor mensal"
            required
            prefix="R$"
            value={formatMoneyDigits(form.monthlyAmountDigits)}
            onChangeText={(text) =>
              patch({ monthlyAmountDigits: maskMoneyDigits(text) })
            }
            error={errors.monthlyAmountDigits}
            placeholder="0,00"
            keyboardType="number-pad"
            maxLength={12}
          />
          <FormField
            label="Dia do vencimento"
            hint={`Vence todo dia ${form.dueDay}.`}
          >
            <DayOfMonthPicker
              value={form.dueDay}
              onChange={(dueDay) => patch({ dueDay })}
            />
          </FormField>
          <Note>
            Valor e vencimento valem para as próximas faturas. As faturas já
            geradas não mudam.
          </Note>
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
