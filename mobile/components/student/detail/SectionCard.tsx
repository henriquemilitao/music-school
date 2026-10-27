import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { Card } from '../../ui/Card';
import { Badge } from './Badge';

type SectionCardProps = {
  title: string;
  children: ReactNode;
  // Selo ao lado do título (ex: "Em dia")
  status?: { label: string; bg: string; text: string };
  // Se informado, mostra o botão discreto "Editar" no canto
  onEdit?: () => void;
};

// Cartão de seção do detalhe: título dourado em caixa alta, selo opcional e
// botão "Editar" pequeno.
export function SectionCard({
  title,
  children,
  status,
  onEdit,
}: SectionCardProps) {
  return (
    <View className="mb-2.5">
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-xs font-bold uppercase tracking-widest text-[#B08D57]">
            {title}
          </Text>
          <View className="flex-row items-center gap-2">
            {status && (
              <Badge label={status.label} bg={status.bg} color={status.text} />
            )}
            {onEdit && (
              <TouchableOpacity
                onPress={onEdit}
                className="flex-row items-center gap-1 rounded-full px-2.5 py-1 bg-[#F3EADD]"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${title}`}
              >
                <Pencil size={11} color="#B08D57" />
                <Text className="text-[11px] font-bold text-[#B08D57]">
                  Editar
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {children}
      </Card>
    </View>
  );
}
