import { Text, View } from 'react-native';
import {
  Ban,
  CheckCircle2,
  History,
  Receipt,
  UserMinus,
} from 'lucide-react-native';
import { formatEndsAt } from '../detail/format';
import { Card } from '../../ui/Card';

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function Line({
  icon: Icon,
  color,
  bg,
  children,
}: {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className="w-8 h-8 rounded-lg items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <Icon size={16} color={color} />
      </View>
      <Text className="flex-1 text-sm text-[#1A1A1A]">{children}</Text>
    </View>
  );
}

// Resumo do que o encerramento vai fazer, atualizado a cada escolha.
export function EndSummary({
  lessonsCancelled,
  lessonsKept,
  paymentsDeleted,
  paymentsRefunded,
  paymentsMarkedPaid,
  endsAt,
}: {
  lessonsCancelled: number;
  lessonsKept: number;
  paymentsDeleted: number;
  // Quantas das faturas apagadas já estavam pagas (estorno)
  paymentsRefunded: number;
  // Faturas em aberto que o admin disse que já foram pagas
  paymentsMarkedPaid: number;
  // null = aluno fica inativo agora; data = segue ativo até lá
  endsAt: string | null;
}) {
  return (
    <Card className="gap-3">
      <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
        Resumo
      </Text>
      <Line icon={Ban} color="#DC2626" bg="#FEF2F2">
        <Text className="font-semibold">
          {plural(lessonsCancelled, 'aula cancelada', 'aulas canceladas')}
        </Text>
      </Line>
      <Line icon={History} color="#B08D57" bg="#F3EADD">
        <Text className="font-semibold">
          {plural(lessonsKept, 'aula fica', 'aulas ficam')}
        </Text>{' '}
        no histórico
      </Line>
      <Line icon={Receipt} color="#4B5563" bg="#F3F4F6">
        <Text className="font-semibold">
          {paymentsDeleted === 0
            ? 'Nenhuma fatura apagada'
            : plural(paymentsDeleted, 'fatura apagada', 'faturas apagadas')}
        </Text>
        {paymentsRefunded > 0
          ? ` (${plural(paymentsRefunded, 'estornada', 'estornadas')})`
          : ''}
      </Line>
      {paymentsMarkedPaid > 0 ? (
        <Line icon={CheckCircle2} color="#059669" bg="#ECFDF5">
          <Text className="font-semibold">
            {plural(
              paymentsMarkedPaid,
              'fatura marcada como paga',
              'faturas marcadas como pagas',
            )}
          </Text>
        </Line>
      ) : null}
      <Line icon={UserMinus} color="#4B5563" bg="#F3F4F6">
        {endsAt ? (
          <>
            Aluno segue ativo até{' '}
            <Text className="font-semibold">{formatEndsAt(endsAt)}</Text> (fim
            da última aula) e então fica inativo
          </>
        ) : (
          <Text className="font-semibold">Aluno fica inativo agora</Text>
        )}
      </Line>
    </Card>
  );
}
