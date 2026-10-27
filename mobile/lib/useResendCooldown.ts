import { useCallback, useEffect, useState } from 'react';

// Contagem regressiva em segundos até liberar uma ação repetível
// (ex: "Reenviar link"). `start(n)` reinicia; `seconds` para sozinho em 0.
export function useResendCooldown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const start = useCallback((total: number) => setSeconds(total), []);

  return { seconds, start };
}
