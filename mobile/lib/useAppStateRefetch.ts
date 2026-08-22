import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';

// Escuta quando o app volta do background pro primeiro plano
// (ex: usuÃ¡rio saiu pro app do banco pra pagar o PIX, e voltou) e
// forÃ§a um refetch IMEDIATO da query informada, sem esperar o
// prÃ³ximo tick do polling.
//
// Isso existe porque o React Native suspende/reduz timers em JS
// (como o setInterval do refetchInterval) quando o app estÃ¡ em
// background â€” Ã© comportamento do SO pra economizar bateria, nÃ£o
// um bug. Sem isso, o usuÃ¡rio precisaria esperar atÃ© 5s (ou mais,
// se o timer tiver ficado atrasado) depois de voltar pro app antes
// da tela atualizar sozinha.
export function useAppStateRefetch(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        // sÃ³ dispara quando a transiÃ§Ã£o for DE background/inactive
        // PRA active â€” evita refetch desnecessÃ¡rio noutras transiÃ§Ãµes
        if (
          appState.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          queryClient.invalidateQueries({ queryKey });
        }
        appState.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [queryClient, queryKey]);
}
