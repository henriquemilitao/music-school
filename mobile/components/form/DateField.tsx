import { View, Text, TouchableOpacity } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { FormField } from './FormField';
import { DatePickerTrigger } from './DatePickerTrigger';
import { dateWithWeekdayShort } from '../../lib/newStudent';
import { FIELD_HEIGHT, FIELD_PADDING_X } from './fieldMetrics';

type DateFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  // DD/MM/AAAA ('' = nada escolhido)
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// Campo de data que abre o calendário (em vez de digitar números). Mostra
// o dia da semana junto da data: "seg, 02/11/2026".
export function DateField({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  placeholder = 'Escolher data',
}: DateFieldProps) {
  const display = dateWithWeekdayShort(value);

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <DatePickerTrigger value={value} onChange={onChange}>
        {(open) => (
          <TouchableOpacity
            onPress={open}
            activeOpacity={0.7}
            className="flex-row items-center justify-between rounded-xl"
            style={{
              height: FIELD_HEIGHT,
              paddingHorizontal: FIELD_PADDING_X,
              borderWidth: error ? 1.5 : 1,
              borderColor: error ? '#FCA5A5' : 'rgba(0,0,0,0.08)',
              backgroundColor: '#F5F1EA',
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${display ?? 'nenhuma data escolhida'}`}
            accessibilityHint="Abre o calendário"
          >
            <Text
              className="text-[15px] flex-1"
              style={{
                color: display ? '#1A1A1A' : '#B0AA9C',
                includeFontPadding: false,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {display ?? placeholder}
            </Text>
            <View className="ml-2">
              <CalendarDays size={18} color="#B08D57" />
            </View>
          </TouchableOpacity>
        )}
      </DatePickerTrigger>
    </FormField>
  );
}
