import { Fragment } from 'react';
import { View, Text } from 'react-native';
import { Check } from 'lucide-react-native';

type StepIndicatorProps = {
  labels: readonly string[];
  current: number;
};

// Barra de progresso do formulário em etapas: bolinhas numeradas ligadas
// por uma linha; etapas concluídas viram "check".
export function StepIndicator({ labels, current }: StepIndicatorProps) {
  return (
    <View
      accessible
      accessibilityLabel={`Etapa ${current + 1} de ${labels.length}: ${labels[current]}`}
    >
      <View className="flex-row items-center">
        {labels.map((label, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <Fragment key={label}>
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
              {index < labels.length - 1 && (
                <View
                  className="h-0.5 flex-1 mx-1.5 rounded-full"
                  style={{ backgroundColor: done ? '#B08D57' : '#E8E2D6' }}
                />
              )}
            </Fragment>
          );
        })}
      </View>
      <Text className="text-xs text-gray-500 mt-2.5">
        Etapa {current + 1} de {labels.length} ·{' '}
        <Text className="font-semibold text-[#1A1A1A]">{labels[current]}</Text>
      </Text>
    </View>
  );
}
