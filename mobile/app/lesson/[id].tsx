import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { Clock, User, Music, StickyNote } from 'lucide-react-native';
import { useCallback } from 'react';
import { api } from '../../lib/api';
import { formatInstrument } from '../../lib/instrument';
import {
  formatLessonFullDate,
  formatLessonTimeRange,
} from '../../lib/lessonFormat';
import { lessonStatusConfig, getEffectiveLessonStatus } from '../../lib/status';
import { StatusPill } from '../../components/ui/StatusPill';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { Card } from '../../components/ui/Card';
import { InfoRow } from '../../components/ui/InfoRow';
import { LessonNotesCard } from '../../components/lesson/LessonNotesCard';
import { useLessonStatus } from '../../lib/useLessonStatus';

type Lesson = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isMakeup: boolean;
  notes: string | null;
  notesUpdatedAt: string | null;
  cancelReason: string | null;
  teacher: { user: { name: string } } | null;
  student: { name: string; instrument: string | null };
};

export default function LessonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const {
    data: lesson,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['lesson', id],
    queryFn: async () => {
      const response = await api.get<Lesson>(`/lessons/my/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // ao sair dessa tela, invalida a lista de aulas — assim, se essa
  // aula mudou de status enquanto o usuário estava vendo o detalhe
  // (ex: cron rodou nesse meio tempo), a lista já volta atualizada
  useFocusEffect(
    useCallback(() => {
      return () => {
        queryClient.invalidateQueries({ queryKey: ['lessons'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      };
    }, [queryClient]),
  );

  // status ao vivo, só é relevante enquanto a aula ainda está SCHEDULED
  // no banco (se já virou COMPLETED, o status do banco já manda)
  const liveStatus = useLessonStatus(
    lesson?.status === 'SCHEDULED' ? lesson.scheduledAt : null,
    lesson?.status === 'SCHEDULED' ? lesson.durationMinutes : null,
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F1EA]">
        <ActivityIndicator size="large" color="#B08D57" />
      </View>
    );
  }

  if (error || !lesson) {
    return (
      <View className="flex-1 bg-[#F5F1EA]">
        <Stack.Screen options={{ headerShown: false }} />
        <ScreenHeader title="Detalhes da aula" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-red-500 text-center">
            Não foi possível carregar essa aula
          </Text>
        </View>
      </View>
    );
  }

  const effectiveStatus = getEffectiveLessonStatus(
    lesson.status,
    liveStatus?.phase,
  );
  const config = lessonStatusConfig(effectiveStatus, lesson.isMakeup);

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
        <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <StatusPill {...config} />
        </View>
      </View>

      <View className="px-5 gap-4 pb-10">
        <Card className="gap-4">
          <InfoRow
            icon={Clock}
            label="Horário"
            value={formatLessonTimeRange(
              lesson.scheduledAt,
              lesson.durationMinutes,
            )}
          />
          {lesson.teacher && (
            <InfoRow
              icon={User}
              label="Professor"
              value={lesson.teacher.user.name}
            />
          )}
          {lesson.student.instrument && (
            <InfoRow
              icon={Music}
              label="Instrumento"
              value={formatInstrument(lesson.student.instrument)}
            />
          )}
        </Card>

        {lesson.status === 'CANCELLED' && lesson.cancelReason && (
          <Card>
            <View className="flex-row items-center gap-2 mb-3">
              <StickyNote size={18} color="#DC2626" />
              <Text className="text-sm font-bold">Motivo da falta</Text>
            </View>
            <Text className="text-gray-600 text-sm leading-5">
              {lesson.cancelReason}
            </Text>
          </Card>
        )}

        {lesson.notes && (
          <LessonNotesCard
            notes={lesson.notes}
            updatedAt={lesson.notesUpdatedAt}
          />
        )}
      </View>
    </ScrollView>
  );
}
