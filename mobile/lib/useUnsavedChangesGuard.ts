import { useRef } from 'react';
import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { confirmAsync } from './dialog';

// Pergunta antes de sair de uma tela com alterações não salvas (botão voltar
// do header, gesto e botão voltar do Android).
//
// Depois de SALVAR, chame `allowLeave()` imediatamente antes de fechar a tela
// (router.back()): como o `dirty` só é recalculado no próximo render, sem isso
// o fechamento ainda seria barrado e o app perguntaria "Descartar alterações?"
// para quem acabou de salvar.
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation();
  const leaving = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) {
      // já salvou: deixa sair sem perguntar nada
      void Promise.resolve().then(() => navigation.dispatch(data.action));
      return;
    }

    void confirmAsync({
      title: 'Descartar alterações?',
      message: 'As alterações que você fez ainda não foram salvas.',
      confirmText: 'Descartar',
      cancelText: 'Continuar editando',
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  return {
    allowLeave: () => {
      leaving.current = true;
    },
  };
}
