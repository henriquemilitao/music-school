import { View, Text, Switch } from 'react-native';
import { Card } from '../../ui/Card';
import { TextField, FormField } from '../../form/FormField';
import { DateField } from '../../form/DateField';
import { DatePickerTrigger } from '../../form/DatePickerTrigger';
import { ChoiceChips } from '../../form/ChoiceChips';
import { OptionRow } from '../../form/OptionRow';
import {
  DURATION_OPTIONS,
  dateWithWeekdayShort,
  formatMoneyDigits,
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
  const lessonDateLabel = dateWithWeekdayShort(form.firstLessonDate);
  const customDue = form.firstPaymentDueDate !== '';
  const customDueLabel = dateWithWeekdayShort(form.firstPaymentDueDate);

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

      {/* Data e horário lado a lado */}
      <View>
        <View className="flex-row gap-3 items-start">
          <View style={{ flex: 3 }}>
            <DateField
              label="Primeira aula"
              required
              value={form.firstLessonDate}
              onChange={(firstLessonDate) => onChange({ firstLessonDate })}
              error={errors.firstLessonDate}
            />
          </View>
          <View style={{ flex: 2 }}>
            <TextField
              label="Horário"
              required
              value={form.startTime}
              onChangeText={(text) => onChange({ startTime: maskTime(text) })}
              error={errors.startTime}
              placeholder="15:00"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>
        <Text className="text-xs text-gray-400 mt-1.5 px-1">
          {weekday
            ? `As aulas serão toda ${weekday}${form.startTime.length === 5 ? ` às ${form.startTime}` : ''}.`
            : 'A data define o dia da semana fixo das aulas.'}
        </Text>
      </View>

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

      {/* Vencimento da 1ª mensalidade: duas opções, uma por linha */}
      <FormField label="Vencimento da 1ª mensalidade">
        <View className="gap-2.5">
          <OptionRow
            selected={!customDue}
            title="Mesma data da primeira aula"
            subtitle={
              lessonDateLabel
                ? `Vence em ${lessonDateLabel}`
                : 'Escolha antes a data da primeira aula'
            }
            onPress={() => onChange({ firstPaymentDueDate: '' })}
          />
          <DatePickerTrigger
            value={form.firstPaymentDueDate || form.firstLessonDate}
            onChange={(firstPaymentDueDate) =>
              onChange({ firstPaymentDueDate })
            }
          >
            {(open) => (
              <OptionRow
                selected={customDue}
                title={customDue ? 'Outra data' : 'Escolher outra data'}
                subtitle={
                  customDue && customDueLabel
                    ? `Vence em ${customDueLabel} · toque para alterar`
                    : 'Abre o calendário'
                }
                onPress={open}
                trailingIcon
              />
            )}
          </DatePickerTrigger>
        </View>
      </FormField>

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
