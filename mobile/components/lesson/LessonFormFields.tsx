import { useState } from 'react';
import { Text, View } from 'react-native';
import { Info } from 'lucide-react-native';
import { INSTRUMENT_OPTIONS } from '../../lib/instrument';
import { combineDateTime, type LessonFormErrors } from '../../lib/lessonForm';
import {
  CANCEL_REASON_MAX_LENGTH,
  type LessonStatus,
  type TeacherOption,
} from '../../lib/lessonTypes';
import { firstName } from '../../lib/name';
import { DURATION_OPTIONS } from '../../lib/newStudent';
import { adminLessonStatusConfig } from '../../lib/status';
import { ChoiceChips } from '../form/ChoiceChips';
import { DateField } from '../form/DateField';
import { FormField, TextField } from '../form/FormField';
import { TimeField } from '../form/TimeField';

// Pedaços de formulário de aula, compartilhados entre editar, nova aula e a
// edição em lote.

// Situações com a mesma cor que têm no resto do app (amarela, verde,
// vermelha): ao escolher, a pílula fica dessa cor.
export const LESSON_STATUS_CHOICES: {
  value: LessonStatus;
  label: string;
  selectedColor: string;
}[] = [
  ['SCHEDULED', 'Agendada'],
  ['COMPLETED', 'Realizada'],
  ['CANCELLED', 'Cancelada'],
].map(([value, label]) => ({
  value: value as LessonStatus,
  label,
  selectedColor: adminLessonStatusConfig(value as LessonStatus).colorText,
}));

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
  // Data e horário lado a lado: são dois campos curtos
  return (
    <View className="flex-row gap-3">
      <View style={{ flex: 3 }}>
        <DateField
          label={dateLabel}
          required
          value={date}
          onChange={(next) => onChange({ date: next })}
          error={errors?.date}
        />
      </View>
      <View style={{ flex: 2 }}>
        <TimeField
          label={timeLabel}
          required
          value={time}
          onChange={(next) => onChange({ time: next })}
          error={errors?.time}
        />
      </View>
    </View>
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
  rescheduled = false,
  onChange,
}: {
  status: LessonStatus;
  cancelReason: string;
  date: string;
  time: string;
  error?: string;
  // A situação voltou para "Agendada" sozinha porque a data ficou no futuro
  rescheduled?: boolean;
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
          options={LESSON_STATUS_CHOICES}
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

      {rescheduled && (
        <LessonNote>
          Como a nova data é futura, a aula voltou para “Agendada”. Dá para
          trocar a situação acima se preferir outra.
        </LessonNote>
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
