// lib/useCountdown.ts
import { useEffect, useState } from 'react';

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
};

function diffToCountdown(targetIso: string): Countdown {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diffMs = target - now;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isPast: false };
}

// Countdown vivo até `targetIso`, atualizado a cada segundo.
// Pensado pra uso pontual (ex: só a próxima aula) — não usar em
// listas, pra não criar um setInterval por item.
export function useCountdown(
  targetIso: string | null | undefined,
): Countdown | null {
  const [countdown, setCountdown] = useState<Countdown | null>(
    targetIso ? diffToCountdown(targetIso) : null,
  );

  useEffect(() => {
    if (!targetIso) {
      setCountdown(null);
      return;
    }

    setCountdown(diffToCountdown(targetIso));
    const interval = setInterval(() => {
      setCountdown(diffToCountdown(targetIso));
    }, 1000);

    return () => clearInterval(interval);
  }, [targetIso]);

  return countdown;
}

// Buffer de segurança: o countdown mostrado no app é sempre um pouco
// menor que o expiresAt real do gateway. Isso garante que, mesmo se
// o usuário copiar o código no último segundo mostrado na tela,
// ainda sobra folga real pra confirmar no banco antes do PIX expirar
// de verdade. NUNCA亀 o inverso (nunca mostrar mais tempo do que existe).
// const COUNTDOWN_DISPLAY_BUFFER_SECONDS = 120; // 2 minutos de folga
// const COUNTDOWN_DISPLAY_BUFFER_SECONDS = 10; // 2 minutos de folga

// export function getDisplayExpiresAt(realExpiresAt: string): string {
//   const real = new Date(realExpiresAt).getTime();
//   const buffered = real - COUNTDOWN_DISPLAY_BUFFER_SECONDS * 1000;
//   return new Date(buffered).toISOString();
// }
