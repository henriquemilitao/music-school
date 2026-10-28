import { View } from 'react-native';
import type { EndMode } from '../../../lib/studentAdmin';
import { OptionRow } from '../../form/OptionRow';

const MODES: { mode: EndMode; title: string; subtitle: string }[] = [
  {
    mode: 'NOW',
    title: 'Encerrar agora',
    subtitle:
      'Todas as aulas agendadas a partir de agora serão canceladas e o aluno fica inativo.',
  },
  {
    mode: 'FROM_LESSON',
    title: 'Encerrar a partir de uma aula',
    subtitle:
      'Você escolhe a primeira aula que deixa de acontecer. Ela e as seguintes serão canceladas.',
  },
  {
    mode: 'AFTER_INVOICE',
    title: 'Encerrar ao fim de uma fatura',
    subtitle:
      'Você escolhe a fatura. As aulas depois do período dela serão canceladas e as faturas seguintes, apagadas.',
  },
];

// As três formas de encerrar. Nenhuma vem marcada: o admin precisa escolher.
export function EndModePicker({
  value,
  onChange,
}: {
  value: EndMode | null;
  onChange: (mode: EndMode) => void;
}) {
  return (
    <View className="gap-2.5" accessibilityRole="radiogroup">
      {MODES.map((item) => (
        <OptionRow
          key={item.mode}
          selected={value === item.mode}
          title={item.title}
          subtitle={item.subtitle}
          onPress={() => onChange(item.mode)}
        />
      ))}
    </View>
  );
}
