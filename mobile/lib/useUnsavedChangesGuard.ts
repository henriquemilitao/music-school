import { useNavigation } from 'expo-router';
import { usePreventRemove } from '@react-navigation/native';
import { confirmAsync } from './confirm';

// Pergunta antes de sair de uma tela com alterações não salvas (botão voltar
// do header, gesto e botão voltar do Android).
export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation();

  usePreventRemove(dirty, ({ data }) => {
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
}
