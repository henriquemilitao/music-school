import { useState } from 'react';
import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { INSTRUMENT_OPTIONS } from '../../lib/instrument';
import { combineDateTime, type LessonFormErrors } from '../../lib/lessonForm';
import {
  formatLessonShortDate,
  formatLessonTime,
} from '../../lib/lessonFormat';
import {
  CANCEL_REASON_MAX_LENGTH,
  type LessonStatus,
  type StudentLesson,
  type TeacherOption,
} from '../../lib/lessonTypes';
import { firstName } from '../../lib/name';
import { DURATION_OPTIONS } from '../../lib/newStudent';
import { ChoiceChips } from '../form/ChoiceChips';
import { DateField } from '../form/DateField';
import { FormField, TextField } from '../form/FormField';
import { OptionRow } from '../form/OptionRow';
import { TimeField } from '../form/TimeField';
import { ToggleRow } from '../form/ToggleRow';

// Pedaços de formulário de aula, compartilhados entre editar, nova aula,
// cancelar com reposição e a edição em lote.

const STATUS_OPTIONS: { value: LessonStatus; label: string }[] = [
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'COMPLETED', label: 'Realizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export function LessonNote({ children }: { children: React.ReactNode }) {
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

// ─── Dia e horário ────────────────────────────────────────────────────

export function LessonWhenFields({
  date,
  time,
  errors,
  onChange,
  dateLabel = 'Data',
  timeLabel = 'Horário',
}: {
  date: string;
  time: string;
  errors?: Pick<LessonFormErrors, 'date' | 'time'>;
  onChange: (patch: { date?: string; time?: string }) => void;
  dateLabel?: string;
  timeLabel?: string;
}) {
  return (
    <>
      <DateField
        label={dateLabel}
        required
        value={date}
        onChange={(next) => onChange({ date: next })}
        error={errors?.date}
      />
      <TimeField
        label={timeLabel}
        required
        value={time}
        onChange={(next) => onChange({ time: next })}
        error={errors?.time}
      />
    </>
  );
}

// ─── Duração, instrumento e professor ─────────────────────────────────

// Inclui a duração atual na lista quando ela não é uma das padrão (ex: 50 min)
function durationChoices(current: number | null) {
  const minutes: number[] = [...DURATION_OPTIONS];
  if (current !== null && !minutes.includes(current)) {
    minutes.push(current);
    minutes.sort((a, b) => a - b);
  }
  return minutes;
}

type KeepOption<T> = { value: T | null; label: string };

export function LessonAssignmentFields({
  durationMinutes,
  instrument,
  teacherId,
  teachers,
  onChange,
  // Edição em lote: uma opção "Manter" (null) em cada grupo
  allowKeep = false,
  durationError,
}: {
  durationMinutes: number | null;
  instrument: string | null;
  teacherId: string | null;
  teachers: TeacherOption[];
  onChange: (patch: {
    durationMinutes?: number | null;
    instrument?: string | null;
    teacherId?: string | null;
  }) => void;
  allowKeep?: boolean;
  durationError?: string;
}) {
  const keep = <T,>(): KeepOption<T>[] =>
    allowKeep ? [{ value: null, label: 'Manter' }] : [];

  return (
    <>
      <FormField label="Duração" error={durationError}>
        <ChoiceChips
          options={[
            ...keep<number>(),
            ...durationChoices(durationMinutes).map((minutes) => ({
              value: minutes as number | null,
              label: `${minutes} min`,
            })),
          ]}
          value={durationMinutes}
          onChange={(value) => onChange({ durationMinutes: value })}
        />
      </FormField>

      <FormField label="Instrumento">
        <ChoiceChips
          options={[
            ...keep<string>(),
            ...INSTRUMENT_OPTIONS.map((option) => ({
              value: option.value as string | null,
              label: option.label,
            })),
          ]}
          value={instrument}
          onChange={(value) => onChange({ instrument: value })}
        />
      </FormField>

      {teachers.length > 0 && (
        <FormField label="Professor">
          <ChoiceChips
            options={[
              ...(allowKeep
                ? [{ value: null as string | null, label: 'Manter' }]
                : [{ value: null as string | null, label: 'Sem professor' }]),
              ...teachers.map((teacher) => ({
                value: teacher.id as string | null,
                label: firstName(teacher.user.name),
              })),
            ]}
            value={teacherId}
            onChange={(value) => onChange({ teacherId: value })}
          />
        </FormField>
      )}
    </>
  );
}

// ─── Status (e motivo do cancelamento) ────────────────────────────────

export function LessonStatusFields({
  status,
  cancelReason,
  date,
  time,
  error,
  onChange,
}: {
  status: LessonStatus;
  cancelReason: string;
  date: string;
  time: string;
  error?: string;
  onChange: (patch: { status?: LessonStatus; cancelReason?: string }) => void;
}) {
  // Aula "agendada" no passado: o servidor marca como realizada sozinho.
  // "Agora" fica fixo desde que a tela abriu — é só um aviso, não precisa de
  // relógio ao vivo.
  const [openedAt] = useState(() => Date.now());
  const when = combineDateTime(date, time);
  const scheduledInThePast =
    status === 'SCHEDULED' && !!when && when.getTime() < openedAt;

  return (
    <>
      <FormField label="Situação da aula">
        <ChoiceChips
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => onChange({ status: value })}
        />
      </FormField>

      {status === 'CANCELLED' && (
        <TextField
          label="Motivo do cancelamento"
          hint="Opcional"
          value={cancelReason}
          onChangeText={(text) => onChange({ cancelReason: text })}
          error={error}
          placeholder="Ex: aluno doente, feriado"
          maxLength={CANCEL_REASON_MAX_LENGTH}
        />
      )}

      {scheduledInThePast && (
        <LessonNote>
          Essa data já passou: aulas agendadas no passado são marcadas como
          realizadas automaticamente em poucos minutos.
        </LessonNote>
      )}
    </>
  );
}

// ─── Reposição ────────────────────────────────────────────────────────

export function MakeupFields({
  isMakeup,
  makeupForLessonId,
  candidates,
  onChange,
}: {
  isMakeup: boolean;
  makeupForLessonId: string | null;
  // Aulas canceladas que ainda podem ser repostas
  candidates: StudentLesson[];
  onChange: (patch: {
    isMakeup?: boolean;
    makeupForLessonId?: string | null;
  }) => void;
}) {
  return (
    <>
      <ToggleRow
        label="É uma aula de reposição"
        description="Marca a aula como reposição de outra"
        value={isMakeup}
        onChange={(value) =>
          onChange({
            isMakeup: value,
            makeupForLessonId: value ? makeupForLessonId : null,
          })
        }
      />

      {isMakeup && (
        <FormField
          label="Qual aula está sendo reposta?"
          hint="Opcional. Se não informar, fica só como reposição."
        >
          <View className="gap-2">
            <OptionRow
              selected={makeupForLessonId === null}
              title="Não informar"
              onPress={() => onChange({ makeupForLessonId: null })}
            />
            {candidates.map((candidate) => (
              <OptionRow
                key={candidate.id}
                selected={makeupForLessonId === candidate.id}
                title={`${formatLessonShortDate(candidate.scheduledAt)} · ${formatLessonTime(candidate.scheduledAt)}`}
                subtitle={candidate.cancelReason ?? 'Cancelada'}
                onPress={() => onChange({ makeupForLessonId: candidate.id })}
              />
            ))}
            {candidates.length === 0 && (
              <Text className="text-xs text-gray-400 px-1">
                Não há aulas canceladas sem reposição para vincular.
              </Text>
            )}
          </View>
        </FormField>
      )}
    </>
  );
}
