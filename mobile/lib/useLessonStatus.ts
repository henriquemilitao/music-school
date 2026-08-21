// lib/useLessonStatus.ts
import { useEffect, useState } from 'react';

export type LessonPhase =
  'upcoming' | 'in_progress' | 'recently_finished' | 'finished';

export type LessonStatusInfo = {
  phase: LessonPhase;
  // countdown até o início (só relevante quando phase === 'upcoming')
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null;
  // progresso 0–1 dentro da aula (só relevante quando phase === 'in_progress')
  progress: number | null;
  // segundos restantes da aula em andamento (pra exibir mm:ss na barra)
  secondsRemaining: number | null;
};

// precisa bater com RECENTLY_FINISHED_GRACE_MINUTES do backend
// (lessons.service.ts -> getDashboard), senão o front pode mostrar
// "acabou de terminar" além do período em que o backend ainda
// retorna essa aula como nextLesson (ou vice-versa, sumir antes)
const RECENTLY_FINISHED_GRACE_MINUTES = 30;

function computeStatus(
  scheduledAtIso: string,
  durationMinutes: number,
): LessonStatusInfo {
  const start = new Date(scheduledAtIso).getTime();
  const end = start + durationMinutes * 60_000;
  const graceEnd = end + RECENTLY_FINISHED_GRACE_MINUTES * 60_000;
  const now = Date.now();

  if (now < start) {
    const totalSeconds = Math.floor((start - now) / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      phase: 'upcoming',
      countdown: { days, hours, minutes, seconds },
      progress: null,
      secondsRemaining: null,
    };
  }

  if (now >= start && now < end) {
    const elapsed = now - start;
    const total = end - start;
    const secondsRemaining = Math.floor((end - now) / 1000);
    return {
      phase: 'in_progress',
      countdown: null,
      progress: elapsed / total, // 0 no início, 1 no fim
      secondsRemaining,
    };
  }

  if (now >= end && now < graceEnd) {
    return {
      phase: 'recently_finished',
      countdown: null,
      progress: null,
      secondsRemaining: null,
    };
  }

  return {
    phase: 'finished',
    countdown: null,
    progress: null,
    secondsRemaining: null,
  };
}

// Estado vivo de uma aula (upcoming/in_progress/recently_finished/
// finished), atualizado a cada segundo. Quando a aula passa pra
// "finished" (ou seja, saiu até do período de graça), dispara
// `onFinish` UMA única vez (não repete) — pensado pra acionar um
// refetch pontual do dashboard nesse momento, caso o cron ainda não
// tenha rodado e a aula ainda apareça como SCHEDULED.
export function useLessonStatus(
  scheduledAtIso: string | null | undefined,
  durationMinutes: number | null | undefined,
  onFinish?: () => void,
): LessonStatusInfo | null {
  const [status, setStatus] = useState<LessonStatusInfo | null>(
    scheduledAtIso && durationMinutes
      ? computeStatus(scheduledAtIso, durationMinutes)
      : null,
  );

  useEffect(() => {
    if (!scheduledAtIso || !durationMinutes) {
      setStatus(null);
      return;
    }

    let firedFinish = false;
    setStatus(computeStatus(scheduledAtIso, durationMinutes));

    const interval = setInterval(() => {
      const next = computeStatus(scheduledAtIso, durationMinutes);
      setStatus(next);

      if (next.phase === 'recently_finished' && !firedFinish) {
        firedFinish = true;
        onFinish?.();
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledAtIso, durationMinutes]);

  return status;
}
