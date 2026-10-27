import { ReactNode, createElement, useState } from 'react';
import { Platform, Modal, View, Text, TouchableOpacity } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { dateToText, parseDate, textToDate } from '../../lib/newStudent';

type DatePickerTriggerProps = {
  // Data atual no formato DD/MM/AAAA ('' = sem data).
  value: string;
  onChange: (value: string) => void;
  // Recebe a função que abre o calendário; quem usa desenha o "gatilho"
  // (um campo, um botão de opção...).
  children: (open: () => void) => ReactNode;
};

// Abre o calendário nativo de cada plataforma:
//   Android → grade de mês nativa (mostra o dia da semana)
//   iOS     → calendário mensal dentro de um modal
//   Web     → <input type="date"> escondido (só pra testar no navegador)
// O valor entra e sai como texto DD/MM/AAAA, igual ao resto do formulário.
export function DatePickerTrigger({
  value,
  onChange,
  children,
}: DatePickerTriggerProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  // Ref por callback+estado (e não useRef) pra não ler ref durante o render.
  const [webInput, setWebInput] = useState<HTMLInputElement | null>(null);

  const current = textToDate(value) ?? new Date();

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        display: 'calendar',
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(dateToText(date));
        },
      });
    } else if (Platform.OS === 'ios') {
      setIosDraft(current);
      setIosOpen(true);
    } else {
      try {
        webInput?.showPicker?.();
      } catch {
        webInput?.focus();
      }
    }
  }

  const iso = parseDate(value) ?? '';

  return (
    <>
      {children(open)}

      {Platform.OS === 'web' &&
        createElement('input', {
          ref: setWebInput,
          type: 'date',
          value: iso,
          tabIndex: -1,
          'aria-hidden': true,
          onChange: (e: { target: { value: string } }) => {
            const [y, m, d] = e.target.value.split('-');
            if (y && m && d) onChange(`${d}/${m}/${y}`);
          },
          style: {
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          },
        })}

      {Platform.OS === 'ios' && (
        <Modal
          visible={iosOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIosOpen(false)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.35)',
              justifyContent: 'center',
              paddingHorizontal: 20,
            }}
            activeOpacity={1}
            onPress={() => setIosOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <View className="bg-white rounded-2xl p-4">
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="inline"
                  onChange={(_, date) => {
                    if (date) setIosDraft(date);
                  }}
                  accentColor="#B08D57"
                />
                <TouchableOpacity
                  className="mt-2 self-center rounded-full bg-[#B08D57] px-6 py-2.5"
                  onPress={() => {
                    onChange(dateToText(iosDraft));
                    setIosOpen(false);
                  }}
                >
                  <Text className="text-white text-sm font-semibold">
                    Confirmar
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}
