import { View, Text } from 'react-native';
import { Cake, IdCard, Mail, Phone, UserRound } from 'lucide-react-native';
import { SectionCard } from './SectionCard';
import { InfoBloco } from './InfoBloco';
import { formatBirthDateWithAge } from './format';

export type StudentProfile = {
  name: string;
  birthDate: string | null;
  age: number | null;
  user: { name: string; email: string; phone: string | null };
};

const DIVIDER = {
  borderTopWidth: 1,
  borderTopColor: 'rgba(0,0,0,0.06)',
} as const;

// Dados cadastrais: aluno e responsável.
export function StudentProfileCard({
  student,
  onEdit,
}: {
  student: StudentProfile;
  onEdit: () => void;
}) {
  return (
    <SectionCard title="Dados cadastrais" onEdit={onEdit}>
      <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Aluno
      </Text>
      <View className="flex-row flex-wrap mb-1">
        <InfoBloco
          label="Nome completo"
          valor={student.name}
          icon={IdCard}
          full
        />
        <InfoBloco
          label="Data de nascimento"
          valor={formatBirthDateWithAge(student.birthDate, student.age)}
          icon={Cake}
          full
        />
      </View>

      <View className="my-3" style={DIVIDER} />

      <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Responsável
      </Text>
      <View className="flex-row flex-wrap">
        <InfoBloco
          label="Nome"
          valor={student.user.name}
          icon={UserRound}
          full
        />
        <InfoBloco
          label="Telefone"
          valor={student.user.phone ?? '—'}
          icon={Phone}
          full
        />
        <InfoBloco label="E-mail" valor={student.user.email} icon={Mail} full />
      </View>
    </SectionCard>
  );
}
