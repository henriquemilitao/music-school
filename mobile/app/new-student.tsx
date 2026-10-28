// app/new-student.tsx
//
// Cadastro de aluno pelo admin, em 4 etapas (Aluno → Aulas → Acesso →
// Revisão). No fim chama POST /users/full, que cria o usuário, o aluno, a
// matrícula (aulas + 1ª mensalidade) e envia o e-mail de convite.

import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Send } from 'lucide-react-native';
import { api } from '../lib/api';
import { confirmAsync } from '../lib/dialog';
import { firstName } from '../lib/name';
import { adminLessonKeys } from '../lib/queryKeys';
import { useKeyboardOverlap } from '../lib/useKeyboardOverlap';
import {
  EMPTY_FORM,
  LAST_STEP,
  STEP_LABELS,
  buildCreateBody,
  firstInvalidStep,
  isFormDirty,
  validateStep,
  type FormErrors,
  type NewStudentForm,
} from '../lib/newStudent';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { InlineFeedback } from '../components/ui/InlineFeedback';
import { StepIndicator } from '../components/form/StepIndicator';
import { StudentStep } from '../components/student/new/StudentStep';
import { EnrollmentStep } from '../components/student/new/EnrollmentStep';
import { AccessStep } from '../components/student/new/AccessStep';
import { ReviewStep } from '../components/student/new/ReviewStep';
import {
  SuccessView,
  type CreatedStudent,
} from '../components/student/new/SuccessView';
import type { TeacherOption } from '../components/student/new/types';

type CreateFullResponse = {
  user: { id: string; email: string };
  students: { student: { id: string } }[];
  inviteLink: string;
  emailSent: boolean;
};

const DISCARD_FORM = {
  title: 'Descartar cadastro?',
  message: 'Os dados preenchidos serão perdidos.',
  confirmText: 'Descartar',
  cancelText: 'Continuar editando',
  destructive: true,
};

export default function NewStudentScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const keyboardOverlap = useKeyboardOverlap();

  const [form, setForm] = useState<NewStudentForm>(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [created, setCreated] = useState<CreatedStudent | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scrollRef, setScrollRef] = useState<ScrollView | null>(null);

  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => {
      const response = await api.get<TeacherOption[]>('/teachers');
      return response.data;
    },
  });

  // Com um único professor (caso comum), ele já vem selecionado; o admin
  // ainda pode trocar para "Definir depois".
  const teacherId =
    form.teacherId !== undefined
      ? form.teacherId
      : teachers.length === 1
        ? teachers[0].id
        : null;
  const teacherName =
    teachers.find((t) => t.id === teacherId)?.user.name ?? null;

  const isDone = created !== null;
  const isDirty = !isDone && isFormDirty(form);

  const patchForm = useCallback((patch: Partial<NewStudentForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    // Limpa o erro dos campos que o admin acabou de mexer.
    setErrors((current) => {
      const next = { ...current };
      (Object.keys(patch) as (keyof NewStudentForm)[]).forEach((key) => {
        delete next[key];
      });
      return next;
    });
    setSubmitError(null);
  }, []);

  function goToStep(next: number) {
    setStep(next);
    setSubmitError(null);
    scrollRef?.scrollTo({ y: 0, animated: false });
  }

  function handleNext() {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length) {
      setErrors(stepErrors);
      scrollRef?.scrollTo({ y: 0, animated: true });
      return;
    }
    setErrors({});
    goToStep(step + 1);
  }

  const createStudent = useMutation({
    mutationFn: async () => {
      const response = await api.post<CreateFullResponse>(
        '/users/full',
        buildCreateBody(form, teacherId),
      );
      return response.data;
    },
    onSuccess: (data) => {
      setCreated({
        userId: data.user.id,
        studentId: data.students[0].student.id,
        email: data.user.email,
        inviteLink: data.inviteLink,
        emailSent: data.emailSent,
      });
      // Lista de alunos, pendências e agenda passam a incluir o novo aluno.
      void queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-enrollments'] });
      void queryClient.invalidateQueries({
        queryKey: ['admin-pending-payments'],
      });
      void queryClient.invalidateQueries({
        queryKey: adminLessonKeys.schedule(),
      });
      scrollRef?.scrollTo({ y: 0, animated: false });
    },
    onError: (error: any) => {
      const status = error?.response?.status;
      if (status === 409) {
        // E-mail já cadastrado: volta para a etapa do e-mail com o erro no campo.
        setErrors({ email: 'Já existe uma conta com este e-mail' });
        goToStep(2);
        return;
      }
      if (status === 400) {
        setSubmitError(
          'Alguns dados não foram aceitos. Revise as etapas e tente de novo.',
        );
        return;
      }
      setSubmitError(
        error?.friendlyMessage ??
          'Não foi possível cadastrar o aluno. Tente novamente.',
      );
    },
  });

  function handleSubmit() {
    // Segurança: revalida tudo antes de enviar (ex: admin voltou e apagou algo).
    const invalidStep = firstInvalidStep(form);
    if (invalidStep !== null) {
      setErrors(validateStep(invalidStep, form));
      goToStep(invalidStep);
      return;
    }
    setSubmitError(null);
    createStudent.mutate();
  }

  // Pular para qualquer etapa (bolinhas do topo). Voltar é livre; avançar
  // só passa se as etapas do caminho estiverem válidas — se alguma não
  // estiver, cai nela mostrando o que falta.
  function handleSelectStep(target: number) {
    if (target === step || isSubmitting) return;
    if (target > step) {
      for (let i = step; i < target; i++) {
        const stepErrors = validateStep(i, form);
        if (Object.keys(stepErrors).length) {
          setErrors(stepErrors);
          goToStep(i);
          return;
        }
      }
    }
    setErrors({});
    goToStep(target);
  }

  // Botão "Voltar" do rodapé: etapa anterior.
  function handlePreviousStep() {
    if (step > 0) goToStep(step - 1);
  }

  // Seta do topo (e botão voltar do Android): sai do cadastro. Se houver
  // dados preenchidos, o usePreventRemove abaixo pergunta antes.
  function handleLeave() {
    if (router.canGoBack()) router.back();
    else router.replace('/(admin)/students');
  }

  usePreventRemove(isDirty && !createStudent.isPending, ({ data }) => {
    void confirmAsync(DISCARD_FORM).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  function resetForm() {
    setForm(EMPTY_FORM);
    setErrors({});
    setStep(0);
    setCreated(null);
    setSubmitError(null);
    createStudent.reset();
  }

  const isSubmitting = createStudent.isPending;
  const isLast = step === LAST_STEP;

  return (
    // O espaço do teclado é aplicado aqui, no fim da tela: o rodapé sobe
    // junto com o teclado e, com o teclado fechado, o padding é zero.
    <View
      className="flex-1 bg-[#F5F1EA]"
      style={{ paddingBottom: keyboardOverlap }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Novo aluno" onBack={handleLeave} />

      <ScrollView
        ref={setScrollRef}
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: isDone ? insets.bottom + 24 : 24,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {isDone && created ? (
          <SuccessView
            form={form}
            created={created}
            onOpenStudent={() =>
              router.replace(`/student/${created.studentId}`)
            }
            onCreateAnother={resetForm}
            onBackToList={() => router.back()}
          />
        ) : (
          <View className="gap-4">
            <StepIndicator
              labels={STEP_LABELS}
              current={step}
              onSelect={handleSelectStep}
            />

            {Object.keys(errors).length > 0 && (
              <InlineFeedback
                type="error"
                message="Confira os campos destacados para continuar."
              />
            )}

            {step === 0 && (
              <StudentStep form={form} errors={errors} onChange={patchForm} />
            )}
            {step === 1 && (
              <EnrollmentStep
                form={form}
                errors={errors}
                onChange={patchForm}
                teachers={teachers}
                teacherId={teacherId}
              />
            )}
            {step === 2 && (
              <AccessStep form={form} errors={errors} onChange={patchForm} />
            )}
            {step === 3 && (
              <ReviewStep
                form={form}
                teacherName={teacherName ? firstName(teacherName) : null}
                onEdit={goToStep}
              />
            )}

            <InlineFeedback type="error" message={submitError} />
          </View>
        )}
      </ScrollView>

      {!isDone && (
        <View
          className="px-5 pt-3 bg-[#F5F1EA] flex-row gap-3"
          style={{
            borderTopWidth: 1,
            borderTopColor: 'rgba(0,0,0,0.05)',
            paddingBottom: keyboardOverlap > 0 ? 12 : insets.bottom + 12,
          }}
        >
          {step > 0 && (
            <TouchableOpacity
              onPress={handlePreviousStep}
              disabled={isSubmitting}
              className="items-center justify-center rounded-xl px-5 h-12 bg-white"
              style={{
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.12)',
                opacity: isSubmitting ? 0.5 : 1,
              }}
              accessibilityRole="button"
              accessibilityLabel="Voltar para a etapa anterior"
            >
              <Text className="font-semibold text-[#1A1A1A]">Voltar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={isLast ? handleSubmit : handleNext}
            disabled={isSubmitting}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl h-12 bg-[#B08D57]"
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text className="text-white font-semibold text-base">
                  {isLast ? 'Criar aluno e enviar convite' : 'Continuar'}
                </Text>
                {isLast ? (
                  <Send size={16} color="#fff" />
                ) : (
                  <ArrowRight size={16} color="#fff" />
                )}
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
