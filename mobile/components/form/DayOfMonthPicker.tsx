import { View, Text, TouchableOpacity } from 'react-native';

type DayOfMonthPickerProps = {
  value: number;
  onChange: (day: number) => void;
};

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Grade 7 × 5 com os dias 1–31 — pra escolher "todo dia X" sem digitar.
export function DayOfMonthPicker({ value, onChange }: DayOfMonthPickerProps) {
  return (
    <View className="flex-row flex-wrap">
      {DAYS.map((day) => {
        const selected = day === value;
        return (
          // largura em % = 7 colunas; o círculo fica centralizado na célula
          <View
            key={day}
            style={{ width: '14.2857%' }}
            className="items-center py-1"
          >
            <TouchableOpacity
              onPress={() => onChange(day)}
              className="w-9 h-9 rounded-full items-center justify-center"
              style={{
                backgroundColor: selected ? '#B08D57' : '#F5F1EA',
                borderWidth: 1,
                borderColor: selected ? '#B08D57' : 'rgba(0,0,0,0.06)',
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Dia ${day}`}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: selected ? '#fff' : '#4B5563' }}
              >
                {day}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}
