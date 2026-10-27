import { useRef } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Card } from '../../ui/Card';
import { TextField, FormField } from '../../form/FormField';
import { ChoiceChips } from '../../form/ChoiceChips';
import { INSTRUMENT_OPTIONS } from '../../../lib/instrument';
import { maskDate, NOTES_MAX_LENGTH } from '../../../lib/newStudent';
import type { StepProps } from './types';

// Etapa 1 — quem é o aluno.
export function StudentStep({ form, errors, onChange }: StepProps) {
  const birthRef = useRef<TextInput>(null);

  return (
    <Card className="gap-5">
      <View>
        <Text
          className="text-lg"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          Dados do aluno
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          Quem vai ter aulas. Campos com * são obrigatórios.
        </Text>
      </View>

      <TextField
        label="Nome do aluno"
        required
        value={form.studentName}
        onChangeText={(studentName) => onChange({ studentName })}
        error={errors.studentName}
        placeholder="Ex: João Silva"
        autoCapitalize="words"
        autoComplete="off"
        maxLength={120}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => birthRef.current?.focus()}
      />

      <FormField label="Instrumento" hint="Pode ser definido depois.">
        <ChoiceChips
          options={INSTRUMENT_OPTIONS}
          value={form.instrument}
          onChange={(instrument) =>
            onChange({
              instrument: form.instrument === instrument ? null : instrument,
            })
          }
        />
      </FormField>

      <TextField
        label="Data de nascimento"
        value={form.birthDate}
        onChangeText={(text) => onChange({ birthDate: maskDate(text) })}
        error={errors.birthDate}
        hint="Opcional. Usada para mostrar a idade."
        placeholder="DD/MM/AAAA"
        keyboardType="number-pad"
        maxLength={10}
        inputRef={birthRef}
      />

      <TextField
        label="Observações"
        value={form.notes}
        onChangeText={(notes) => onChange({ notes })}
        hint={`Opcional. Ex: prefere aulas à tarde. (${form.notes.length}/${NOTES_MAX_LENGTH})`}
        placeholder="Algo importante sobre o aluno"
        multiline
        maxLength={NOTES_MAX_LENGTH}
        autoCapitalize="sentences"
      />
    </Card>
  );
}
