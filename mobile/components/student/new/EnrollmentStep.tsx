import { View, Text, Switch } from 'react-native';
import { Card } from '../../ui/Card';
import { TextField, FormField } from '../../form/FormField';
import { ChoiceChips } from '../../form/ChoiceChips';
import {
  DURATION_OPTIONS,
  formatMoneyDigits,
  maskDate,
  maskMoneyDigits,
  maskTime,
  weekdayName,
} from '../../../lib/newStudent';
import { firstName } from '../../../lib/name';
import type { StepProps, TeacherOption } from './types';

type EnrollmentStepProps = StepProps & {
  teachers: TeacherOption[];
  teacherId: string | null;
};

// Etapa 2 — horário fixo das aulas e mensalidade (a matrícula).
export function EnrollmentStep({
  form,
  errors,
  onChange,
  teachers,
  teacherId,
}: EnrollmentStepProps) {
  const weekday = weekdayName(form.firstLessonDate);

  return (
    <Card className="gap-5">
      <View>
        <Text
          className="text-lg"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Aulas e mensalidade
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          As aulas do primeiro mês e a primeira mensalidade são criadas
          automaticamente.
        </Text>
      </View>

      {teachers.length > 0 && (
        <FormField label="Professor" hint="Pode ser definido depois.">
          <ChoiceChips
            options={[
              ...teachers.map((t) => ({
                value: t.id as string | null,
                label: firstName(t.user.name),
              })),
              { value: null, label: 'Definir depois' },
            ]}
            value={teacherId}
            onChange={(id) => onChange({ teacherId: id })}
          />
        </FormField>
      )}

      <TextField
        label="Primeira aula"
        required
        value={form.firstLessonDate}
        onChangeText={(text) => onChange({ firstLessonDate: maskDate(text) })}
        error={errors.firstLessonDate}
        hint={
          weekday
            ? `As aulas serão toda ${weekday}.`
            : 'Define o dia da semana fixo das aulas.'
        }
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
      />

      <TextField
        label="Horário"
        required
        value={form.startTime}
        onChangeText={(text) => onChange({ startTime: maskTime(text) })}
        error={errors.startTime}
        placeholder="HH:MM"
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
          onChange={(durationMinutes) => onChange({ durationMinutes })}
        />
      </FormField>

      <TextField
        label="Mensalidade"
        required
        prefix="R$"
        value={formatMoneyDigits(form.monthlyAmountDigits)}
        onChangeText={(text) =>
          onChange({ monthlyAmountDigits: maskMoneyDigits(text) })
        }
        error={errors.monthlyAmountDigits}
        placeholder="0,00"
        keyboardType="number-pad"
        maxLength={12}
      />

      <TextField
        label="Vencimento da 1ª mensalidade"
        value={form.firstPaymentDueDate}
        onChangeText={(text) =>
          onChange({ firstPaymentDueDate: maskDate(text) })
        }
        error={errors.firstPaymentDueDate}
        hint="Opcional. Se ficar vazio, vence no dia da primeira aula."
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
      />

      <View
        className="flex-row items-center gap-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: '#F5F1EA' }}
      >
        <View className="flex-1">
          <Text className="text-sm font-semibold text-[#1A1A1A]">
            1ª mensalidade já foi paga
          </Text>
          <Text className="text-xs text-gray-500 mt-0.5">
            Use se o aluno pagou na hora da matrícula.
          </Text>
        </View>
        <Switch
          value={form.firstPaymentPaid}
          onValueChange={(firstPaymentPaid) => onChange({ firstPaymentPaid })}
          trackColor={{ false: '#D4CFC4', true: '#B08D57' }}
          thumbColor="#fff"
          accessibilityLabel="Primeira mensalidade já foi paga"
        />
      </View>
    </Card>
  );
}
