import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { api } from '../../lib/api';
import { maskDate, maskPhone } from '../../lib/newStudent';
import {
  useRefreshStudentData,
  updateStudentProfile,
} from '../../lib/studentAdmin';
import {
  buildProfileBody,
  initialProfileForm,
  isProfileDirty,
  validateProfileForm,
  type ProfileForm,
  type ProfileFormErrors,
} from '../../lib/studentProfileEdit';
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard';
import { ActionFooter } from '../../components/ui/ActionFooter';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DetailScreen } from '../../components/ui/DetailScreen';
import { InlineFeedback } from '../../components/ui/InlineFeedback';
import { TextField } from '../../components/form/FormField';
import type { StudentProfile } from '../../components/student/detail/StudentProfileCard';

type StudentDetail = StudentProfile & { id: string };

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View>
      <Text
        className="text-lg"
        style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
      >
        {title}
      </Text>
      <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>
    </View>
  );
}

export default function EditStudentProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const refreshStudent = useRefreshStudentData();

  const { data: student, isLoading } = useQuery({
    queryKey: ['admin-student', id],
    queryFn: async () => {
      const response = await api.get<StudentDetail>(`/students/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const initial = useMemo(
    () => (student ? initialProfileForm(student) : null),
    [student],
  );

  // Só guardamos o que a pessoa digitou; o resto vem do cadastro atual.
  const [draft, setDraft] = useState<Partial<ProfileForm>>({});
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const phoneRef = useRef<TextInput>(null);
  const guardianEmailRef = useRef<TextInput>(null);
  const birthRef = useRef<TextInput>(null);
  const guardianNameRef = useRef<TextInput>(null);

  const form: ProfileForm | null = initial ? { ...initial, ...draft } : null;
  const dirty = !!initial && !!form && isProfileDirty(initial, form);

  const save = useMutation({
    mutationFn: (body: ReturnType<typeof buildProfileBody>) =>
      updateStudentProfile(id, body),
    onSuccess: () => {
      refreshStudent(id);
      router.back();
    },
    onError: (error: any) => {
      setSubmitError(
        error?.friendlyMessage ?? 'Não foi possível salvar. Tente novamente.',
      );
    },
  });

  // Não pergunta "descartar?" no meio de um salvamento bem-sucedido
  useUnsavedChangesGuard(dirty && !save.isPending && !save.isSuccess);

  function patch(change: Partial<ProfileForm>) {
    setDraft((current) => ({ ...current, ...change }));
    setSubmitError(null);
    const touched = Object.keys(change) as (keyof ProfileForm)[];
    if (touched.some((key) => errors[key])) {
      setErrors((current) => {
        const next = { ...current };
        touched.forEach((key) => delete next[key]);
        return next;
      });
    }
  }

  function handleSave() {
    if (!initial || !form) return;
    const found = validateProfileForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitError(null);
    save.mutate(buildProfileBody(initial, form));
  }

  if (isLoading || !form) {
    return (
      <DetailScreen title="Editar dados">
        <View className="py-20 items-center">
          <ActivityIndicator size="large" color="#B08D57" />
        </View>
      </DetailScreen>
    );
  }

  return (
    <DetailScreen
      title="Editar dados"
      contentPadding
      keyboardShouldPersistTaps="handled"
      footer={
        <ActionFooter>
          <Button
            label="Salvar alterações"
            icon={Check}
            onPress={handleSave}
            disabled={!dirty}
            loading={save.isPending}
          />
        </ActionFooter>
      }
    >
      <View className="gap-4">
        {Object.keys(errors).length > 0 && (
          <InlineFeedback
            type="error"
            message="Confira os campos destacados para salvar."
          />
        )}

        <Card className="gap-5">
          <SectionTitle title="Aluno" subtitle="Quem tem as aulas." />
          <TextField
            label="Nome completo"
            required
            value={form.studentName}
            onChangeText={(studentName) => patch({ studentName })}
            error={errors.studentName}
            autoCapitalize="words"
            maxLength={120}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => birthRef.current?.focus()}
          />
          <TextField
            label="Data de nascimento"
            value={form.birthDate}
            onChangeText={(text) => patch({ birthDate: maskDate(text) })}
            error={errors.birthDate}
            hint="Opcional. Usada para mostrar a idade."
            placeholder="DD/MM/AAAA"
            keyboardType="number-pad"
            maxLength={10}
            inputRef={birthRef}
          />
        </Card>

        <Card className="gap-5">
          <SectionTitle
            title="Responsável"
            subtitle="Quem acessa o app e recebe as cobranças."
          />
          <TextField
            label="Nome"
            required
            value={form.guardianName}
            onChangeText={(guardianName) => patch({ guardianName })}
            error={errors.guardianName}
            autoCapitalize="words"
            maxLength={120}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => guardianEmailRef.current?.focus()}
            inputRef={guardianNameRef}
          />
          <TextField
            label="E-mail"
            required
            value={form.guardianEmail}
            onChangeText={(guardianEmail) => patch({ guardianEmail })}
            error={errors.guardianEmail}
            hint="É o e-mail usado para entrar no app. Ao trocar, a pessoa passa a entrar com o novo."
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
            inputRef={guardianEmailRef}
          />
          <TextField
            label="Telefone"
            value={form.guardianPhone}
            onChangeText={(text) => patch({ guardianPhone: maskPhone(text) })}
            error={errors.guardianPhone}
            placeholder="(67) 99999-9999"
            keyboardType="number-pad"
            maxLength={15}
            inputRef={phoneRef}
          />
        </Card>

        <InlineFeedback type="error" message={submitError} />
      </View>
    </DetailScreen>
  );
}
