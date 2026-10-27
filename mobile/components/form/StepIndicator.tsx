import { View, Text, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';

type StepIndicatorProps = {
  labels: readonly string[];
  current: number;
  // Quando informado, as bolinhas viram botões que levam direto à etapa.
  onSelect?: (index: number) => void;
};

// Barra de progresso do formulário em etapas: bolinhas numeradas com o nome
// embaixo, ligadas por uma linha. Etapas concluídas viram "check". As
// bolinhas são clicáveis para pular direto para outra etapa.
export function StepIndicator({
  labels,
  current,
  onSelect,
}: StepIndicatorProps) {
  return (
    <View className="flex-row">
      {labels.map((label, index) => {
        const done = index < current;
        const active = index === current;
        const isLast = index === labels.length - 1;

        return (
          <View key={label} style={{ flex: 1 }} className="items-center">
            {/* Linha até a próxima bolinha (atrás das bolinhas). */}
            {!isLast && (
              <View
                className="absolute h-0.5 rounded-full"
                style={{
                  top: 13,
                  left: '50%',
                  width: '100%',
                  backgroundColor: done ? '#B08D57' : '#E8E2D6',
                }}
              />
            )}
            <TouchableOpacity
              onPress={() => onSelect?.(index)}
              disabled={!onSelect || active}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              className="items-center"
              accessibilityRole="button"
              accessibilityLabel={`Etapa ${index + 1} de ${labels.length}: ${label}${active ? ', etapa atual' : ''}`}
              accessibilityState={{ selected: active }}
            >
              <View
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{
                  backgroundColor: done || active ? '#B08D57' : '#E8E2D6',
                }}
              >
                {done ? (
                  <Check size={14} color="#fff" />
                ) : (
                  <Text
                    className="text-xs font-bold"
                    style={{ color: active ? '#fff' : '#9A937F' }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                className="text-xs mt-1.5"
                style={{
                  color: active ? '#1A1A1A' : '#9A937F',
                  fontWeight: active ? '700' : '500',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}
