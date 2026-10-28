import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, UserRound } from 'lucide-react-native';
import type { GuardianGroup, StudentRowData } from '../../../lib/studentList';
import { firstName } from '../../../lib/name';
import { Badge } from '../detail/Badge';

const PAYMENT_BADGE = {
  OVERDUE: { label: 'Atrasado', bg: '#FEF2F2', color: '#DC2626' },
  PENDING: { label: 'Pendente', bg: '#FFFBEB', color: '#D97706' },
  OK: { label: 'Em dia', bg: '#ECFDF5', color: '#059669' },
} as const;

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 4,
  elevation: 1,
} as const;

// Uma linha da lista: número, nome, instrumento · professor e situação.
export function StudentRow({
  student,
  index,
  onOpen,
}: {
  student: StudentRowData;
  index: number;
  onOpen: (studentId: string) => void;
}) {
  const badge = PAYMENT_BADGE[student.payment];
  // "Em dia" não diz nada de quem já saiu: só mostra se houver pendência
  const showPayment = !student.inactive || student.payment !== 'OK';

  return (
    <TouchableOpacity
      className="flex-row items-center bg-white rounded-2xl p-3.5"
      style={CARD_SHADOW}
      onPress={() => onOpen(student.id)}
      accessibilityRole="button"
    >
      <View className="w-6 items-center mr-2.5">
        <Text className="text-xs font-medium text-gray-400">{index}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium flex-shrink" numberOfLines={1}>
            {firstName(student.name)}
          </Text>
          {student.inactive && (
            <Badge label="Inativo" bg="#F3F4F6" color="#6B7280" />
          )}
        </View>
        <Text className="text-[13px] text-gray-500 mt-0.5">
          {student.instrumentLabel}
          {student.teacherName ? ` · ${student.teacherName}` : ''}
        </Text>
      </View>
      {showPayment && (
        <View className="mr-2">
          <Badge label={badge.label} bg={badge.bg} color={badge.color} />
        </View>
      )}
      <ChevronRight size={16} color="#D4CFC4" />
    </TouchableOpacity>
  );
}

// Grupo por responsável — sempre mostrado, mesmo com 1 aluno
export function StudentGroup({
  group,
  startIndex,
  onOpen,
}: {
  group: GuardianGroup;
  startIndex: number;
  onOpen: (studentId: string) => void;
}) {
  return (
    <View className="gap-2.5">
      <View className="flex-row items-center gap-2 px-1">
        <UserRound size={14} color="#B08D57" />
        <Text className="text-xs font-medium text-gray-500">
          {group.guardianName}
        </Text>
      </View>
      {group.students.map((student, i) => (
        <StudentRow
          key={student.id}
          student={student}
          index={startIndex + i}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}
