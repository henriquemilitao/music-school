import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Mail } from 'lucide-react-native';
import { Card } from '../../ui/Card';
import { formatInstrument } from '../../../lib/instrument';
import {
  ageText,
  dateWithWeekdayLong,
  formatMoneyDigits,
  weekdayName,
  type NewStudentForm,
} from '../../../lib/newStudent';

type ReviewStepProps = {
  form: NewStudentForm;
  teacherName: string | null;
  onEdit: (step: number) => void;
};

function Section({
  title,
  step,
  onEdit,
  children,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
  children: ReactNode;
}) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
          {title}
        </Text>
        <TouchableOpacity
          onPress={() => onEdit(step)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${title}`}
        >
          <Text className="text-sm font-semibold text-[#1A1A1A]">Editar</Text>
        </TouchableOpacity>
      </View>
      {children}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-[#1A1A1A] font-medium flex-1 text-right">
        {value}
      </Text>
    </View>
  );
}

// Etapa 4 — resumo para conferir antes de criar.
export function ReviewStep({ form, teacherName, onEdit }: ReviewStepProps) {
  const weekday = weekdayName(form.firstLessonDate);
  const holderName =
    form.holder === 'SELF' ? form.studentName.trim() : form.guardianName.trim();

  return (
    <View className="gap-4">
      <Section title="Aluno" step={0} onEdit={onEdit}>
        <Line label="Nome" value={form.studentName.trim()} />
        <Line label="Instrumento" value={formatInstrument(form.instrument)} />
        <Line
          label="Nascimento"
          value={
            form.birthDate
              ? `${form.birthDate} (${ageText(form.birthDate) ?? '—'})`
              : '—'
          }
        />
        {form.notes.trim() ? (
          <Line label="Observações" value={form.notes.trim()} />
        ) : null}
      </Section>

      <Section title="Aulas e mensalidade" step={1} onEdit={onEdit}>
        <Line label="Professor" value={teacherName ?? 'A definir'} />
        <Line
          label="Aulas"
          value={`${weekday ? `Toda ${weekday}` : '—'} às ${form.startTime} · ${form.durationMinutes} min`}
        />
        <Line
          label="Primeira aula"
          value={dateWithWeekdayLong(form.firstLessonDate)}
        />
        <Line
          label="Mensalidade"
          value={`R$ ${formatMoneyDigits(form.monthlyAmountDigits)}`}
        />
        <Line
          label="1º vencimento"
          value={dateWithWeekdayLong(
            form.firstPaymentDueDate || form.firstLessonDate,
          )}
        />
        <Line
          label="1ª mensalidade"
          value={form.firstPaymentPaid ? 'Já paga' : 'A pagar'}
        />
      </Section>

      <Section title="Acesso ao app" step={2} onEdit={onEdit}>
        <Line
          label="Quem acessa"
          value={
            form.holder === 'SELF'
              ? `${holderName} (aluno)`
              : `${holderName} (responsável)`
          }
        />
        <Line label="E-mail" value={form.email.trim().toLowerCase()} />
        <Line label="Telefone" value={form.phone || '—'} />
      </Section>

      <View
        className="flex-row items-start gap-2.5 rounded-xl px-4 py-3"
        style={{ backgroundColor: '#FBF6EC' }}
      >
        <Mail size={16} color="#B08D57" style={{ marginTop: 2 }} />
        <Text className="text-xs text-gray-700 flex-1 leading-5">
          Ao criar, enviamos um e-mail para{' '}
          <Text className="font-semibold">
            {form.email.trim().toLowerCase()}
          </Text>{' '}
          com o link para criar a senha e o link para baixar o app.
        </Text>
      </View>
    </View>
  );
}
