// app/admin-lesson/[id].tsx
//
// Detalhe da aula na visão do admin/professor: dados da aula + anotações
// (o que foi trabalhado, o que estudar). As anotações aparecem pro aluno
// em lesson/[id].tsx.
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from 'react-native';
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  Eye,
  GraduationCap,
  Music,
  NotebookPen,
  Pencil,
  Plus,
  StickyNote,
  User,
} from 'lucide-react-native';
import { api } from '../../lib/api';
import { confirmAsync } from '../../lib/confirm';
import { formatInstrument } from '../../lib/instrument';
import {
  formatLessonFullDate,
  formatLessonShortDate,
  formatLessonTime,
  formatLessonTimeRange,
} from '../../lib/lessonFormat';
import { adminLessonKeys } from '../../lib/queryKeys';
import {
  adminLessonStatusConfig,
  getEffectiveLessonStatus,
  makeupLessonVisual,
  type LessonStatus,
} from '../../lib/status';
import { useLessonStatus } from '../../lib/useLessonStatus';
import { Card } from '../../components/ui/Card';
import { InfoRow } from '../../components/ui/InfoRow';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { StatusPill } from '../../components/ui/StatusPill';
import { LessonNotesCard } from '../../components/lesson/LessonNotesCard';
import { LessonNotesEditor } from '../../components/lesson/LessonNotesEditor';

// ─── Tipos ────────────────────────────────────────────────────────────

type AdminLesson = {
  id: string;
  studentId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: LessonStatus;
  isMakeup: boolean;
  notes: string | null;
  notesUpdatedAt: string | null;
  cancelReason: string | null;
  student: { id: string; name: string; instrument: string | null };
  teacher: { user: { name: string } } | null;
};

const DISCARD_CHANGES = {
  title: 'Descartar alterações?',
  message: 'O que você escreveu ainda não foi salvo.',
  confirmText: 'Descartar',
  cancelText: 'Continuar editando',
  destructive: true,
} as const;

// ─── Componentes ─────────────────────────────────────────────────────

function SaveButton({
  onPress,
  disabled,
  loading,
}: {
  onPress: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className="flex-row items-center justify-center rounded-full bg-[#B08D57] px-4 h-9"
      style={{ minWidth: 92, opacity: disabled && !loading ? 0.4 : 1 }}
      accessibilityRole="button"
      accessibilityLabel="Salvar anotações"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <>
          <Check size={14} color="#fff" />
          <Text className="text-white text-sm font-semibold ml-1.5">
            Salvar
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function EditNotesButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={8}
      className="flex-row items-center gap-1.5 rounded-full bg-[#F3EADD] px-3 py-1.5"
      accessibilityRole="button"
      accessibilityLabel="Editar anotações"
    >
      <Pencil size={12} color="#B08D57" />
      <Text className="text-xs font-semibold text-[#B08D57]">Editar</Text>
    </TouchableOpacity>
  );
}

function VisibleToStudentHint() {
  return (
    <View className="flex-row items-center gap-1.5">
      <Eye size={12} color="#9CA3AF" />
      <Text className="text-xs text-gray-400">Visível para o aluno no app</Text>
    </View>
  );
}

function NotesEmptyState({ onWrite }: { onWrite: () => void }) {
  return (
    <View
      className="items-center bg-white rounded-2xl px-6 py-7"
      style={{
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        borderStyle: 'dashed',
      }}
    >
      <View className="w-11 h-11 rounded-xl bg-[#F3EADD] items-center justify-center mb-3">
        <NotebookPen size={20} color="#B08D57" />
      </View>
      <Text className="text-sm font-bold">Nenhuma anotação ainda</Text>
      <Text className="text-[13px] text-gray-500 text-center leading-5 mt-1">
        Registre o que foi trabalhado e o que estudar em casa. O aluno vê isso
        no app.
      </Text>
      <TouchableOpacity
        onPress={onWrite}
        className="flex-row items-center gap-1.5 rounded-full bg-[#B08D57] px-4 py-2.5 mt-4"
        accessibilityRole="button"
      >
        <Plus size={14} color="#fff" />
        <Text className="text-white text-sm font-semibold">
          Escrever anotações
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Tela principal ───────────────────────────────────────────────────

export default function AdminLessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const {
    data: lesson,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: adminLessonKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<AdminLesson>(`/lessons/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // status ao vivo ("Em andamento") enquanto a aula ainda está SCHEDULED
  const liveStatus = useLessonStatus(
    lesson?.status === 'SCHEDULED' ? lesson.scheduledAt : null,
    lesson?.status === 'SCHEDULED' ? lesson.durationMinutes : null,
  );

  const saveNotes = useMutation({
    mutationFn: async (notes: string | null) => {
      const response = await api.patch<AdminLesson>(`/lessons/${id}`, {
        notes,
      });
      return response.data;
    },
    onSuccess: (updated) => {
      // o PATCH devolve a aula no mesmo formato do GET — atualiza a tela
      // direto, e as listas buscam de novo pra mostrar "Com anotações"
      queryClient.setQueryData(adminLessonKeys.detail(id), updated);
      queryClient.invalidateQueries({ queryKey: adminLessonKeys.schedule() });
      queryClient.invalidateQueries({
        queryKey: adminLessonKeys.byStudent(updated.studentId),
      });
      setIsEditing(false);
    },
  });

  const savedNotes = lesson?.notes ?? '';
  // o backend faz trim, então espaço sobrando no fim não conta como mudança
  const isDirty = isEditing && draft.trim() !== savedNotes;

  function startEditing() {
    setDraft(savedNotes);
    saveNotes.reset();
    setIsEditing(true);
  }

  const cancelEditing = useCallback(async () => {
    if (isDirty && !(await confirmAsync(DISCARD_CHANGES))) return;
    setIsEditing(false);
  }, [isDirty]);

  async function handleSave() {
    const next = draft.trim();
    if (!next && savedNotes) {
      const confirmed = await confirmAsync({
        title: 'Apagar anotações?',
        message: 'O aluno deixa de ver as anotações desta aula.',
        confirmText: 'Apagar',
        destructive: true,
      });
      if (!confirmed) return;
    }
    saveNotes.mutate(next || null);
  }

  // Android: o voltar do sistema, durante a edição, sai do modo edição
  // (em vez de fechar a tela).
  useEffect(() => {
    if (!isEditing) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        void cancelEditing();
        return true;
      },
    );
    return () => subscription.remove();
  }, [isEditing, cancelEditing]);

  // Qualquer outra saída com texto não salvo (gesto de voltar do iOS,
  // navegação programática) pede confirmação antes.
  usePreventRemove(isDirty, ({ data }) => {
    void confirmAsync(DISCARD_CHANGES).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (isError || !lesson) {
    return (
      <View className="flex-1 bg-[#F5F1EA]">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Detalhes da aula" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-500 text-center">
            Não foi possível carregar essa aula
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 rounded-full bg-white px-4 py-2"
            style={{ borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <Text className="text-sm font-medium">Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Modo edição: tela focada na escrita, com "Salvar" sempre visível
  // no topo (nunca fica escondido atrás do teclado) ──────────────────────
  if (isEditing) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-[#F5F1EA]"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader
          title="Anotações da aula"
          onBack={() => void cancelEditing()}
          right={
            <SaveButton
              onPress={() => void handleSave()}
              disabled={!isDirty}
              loading={saveNotes.isPending}
            />
          }
        />
        <View className="flex-1 px-5 pt-4 pb-4">
          <Text className="text-xs text-gray-500 mb-3 px-1" numberOfLines={1}>
            {lesson.student.name} · {formatLessonShortDate(lesson.scheduledAt)}{' '}
            · {formatLessonTime(lesson.scheduledAt)}
          </Text>
          <LessonNotesEditor
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              if (saveNotes.isError) saveNotes.reset();
            }}
            editable={!saveNotes.isPending}
            error={
              saveNotes.isError
                ? 'Não foi possível salvar. Confira sua conexão e tente de novo.'
                : null
            }
          />
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Modo leitura ────────────────────────────────────────────────────
  const statusVisual = adminLessonStatusConfig(
    getEffectiveLessonStatus(lesson.status, liveStatus?.phase),
  );

  return (
    <ScrollView className="flex-1 bg-[#F5F1EA]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Detalhes da aula" />

      <View className="px-5 pt-5 pb-6">
        <Text
          className="text-2xl"
          style={{ fontFamily: 'PlayfairDisplay_700Bold' }}
        >
          {formatLessonFullDate(lesson.scheduledAt)}
        </Text>
        <View className="flex-row flex-wrap gap-2 mt-2">
          <StatusPill {...statusVisual} />
          {lesson.isMakeup && <StatusPill {...makeupLessonVisual} />}
        </View>
      </View>

      <View className="px-5 gap-4 pb-10">
        <Card className="gap-4">
          <InfoRow
            icon={User}
            label="Aluno"
            value={lesson.student.name}
            onPress={() => router.push(`/student/${lesson.student.id}`)}
          />
          <InfoRow
            icon={Clock}
            label="Horário"
            value={formatLessonTimeRange(
              lesson.scheduledAt,
              lesson.durationMinutes,
            )}
          />
          {lesson.student.instrument && (
            <InfoRow
              icon={Music}
              label="Instrumento"
              value={formatInstrument(lesson.student.instrument)}
            />
          )}
          {lesson.teacher && (
            <InfoRow
              icon={GraduationCap}
              label="Professor"
              value={lesson.teacher.user.name}
            />
          )}
        </Card>

        {lesson.status === 'CANCELLED' && lesson.cancelReason && (
          <Card>
            <View className="flex-row items-center gap-2 mb-3">
              <StickyNote size={18} color="#DC2626" />
              <Text className="text-sm font-bold">Motivo do cancelamento</Text>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              {lesson.cancelReason}
            </Text>
          </Card>
        )}

        {lesson.notes ? (
          <LessonNotesCard
            notes={lesson.notes}
            updatedAt={lesson.notesUpdatedAt}
            action={<EditNotesButton onPress={startEditing} />}
            footer={<VisibleToStudentHint />}
          />
        ) : (
          <NotesEmptyState onWrite={startEditing} />
        )}
      </View>
    </ScrollView>
  );
}
