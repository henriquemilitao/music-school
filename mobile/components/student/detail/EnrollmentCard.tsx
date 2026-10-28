import { ActivityIndicator, View, Text } from 'react-native';
import {
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Clock,
  Music,
  UserRound,
  Wallet,
} from 'lucide-react-native';
import { formatInstrument } from '../../../lib/instrument';
import { WEEKDAY_NAMES } from '../../../lib/weekdays';
import { SectionCard } from './SectionCard';
import { InfoBloco } from './InfoBloco';
import { formatCurrencyBRL, formatEndsAt } from './format';

export type EnrollmentSummary = {
  id: string;
  weekDay: number;
  startTime: string;
  durationMinutes: number;
  monthlyAmount: string;
  firstPaymentDueDate: string;
  teacherId: string | null;
  // Encerramento agendado: a matrícula segue ativa até essa data
  endsAt: string | null;
  teacher: { user: { name: string } } | null;
};

const DIVIDER = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(0,0,0,0.06)',
} as const;

type EnrollmentCardProps = {
  enrollment: EnrollmentSummary | null;
  instrument: string | null;
  status?: { label: string; bg: string; text: string };
  loadingStatus?: boolean;
  // Aluno que já teve matrícula (agora encerrada) → mensagem diferente
  ended?: boolean;
  onEdit: () => void;
};

// Matrícula: instrumento, professor, horário, valor e vencimento.
export function EnrollmentCard({
  enrollment,
  instrument,
  status,
  loadingStatus,
  ended,
  onEdit,
}: EnrollmentCardProps) {
  if (!enrollment) {
    return (
      <SectionCard title="Matrícula">
        <View className="items-center py-6 px-4">
          <Text className="text-sm font-medium text-gray-500">
            {ended ? 'Matrícula encerrada' : 'Nenhuma matrícula ativa'}
          </Text>
          {ended && (
            <Text className="text-xs text-gray-400 text-center mt-1.5">
              As aulas e faturas anteriores continuam no histórico, nas abas
              Aulas e Faturas.
            </Text>
          )}
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Matrícula" status={status} onEdit={onEdit}>
      {enrollment.endsAt ? (
        <View
          className="flex-row gap-2 rounded-xl px-3 py-2.5 mb-3"
          style={{ backgroundColor: '#FFFBEB' }}
        >
          <CalendarX2 size={15} color="#D97706" style={{ marginTop: 1 }} />
          <Text className="flex-1 text-xs text-[#92400E] leading-4">
            Encerra em{' '}
            <Text className="font-bold">{formatEndsAt(enrollment.endsAt)}</Text>
            . As aulas depois dessa data já foram canceladas.
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap mb-1">
        <InfoBloco
          label="Instrumento"
          valor={formatInstrument(instrument)}
          icon={Music}
        />
        <InfoBloco
          label="Professor"
          valor={enrollment.teacher?.user.name ?? '—'}
          icon={UserRound}
        />
        <InfoBloco
          label="Dia da aula"
          valor={WEEKDAY_NAMES[enrollment.weekDay]}
          icon={CalendarClock}
        />
        <InfoBloco
          label="Horário"
          valor={`${enrollment.startTime} · ${enrollment.durationMinutes} min`}
          icon={Clock}
        />
      </View>

      <View className="my-3" style={DIVIDER} />

      <View className="flex-row flex-wrap">
        <InfoBloco
          label="Valor mensal"
          valor={formatCurrencyBRL(enrollment.monthlyAmount)}
          icon={Wallet}
        />
        <InfoBloco
          label="Vencimento"
          valor={`Todo dia ${new Date(
            enrollment.firstPaymentDueDate,
          ).getUTCDate()}`}
          icon={CalendarCheck2}
        />
      </View>

      {loadingStatus && (
        <ActivityIndicator
          size="small"
          color="#B08D57"
          style={{ marginTop: 4 }}
        />
      )}
    </SectionCard>
  );
}
