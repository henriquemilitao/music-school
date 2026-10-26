import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// true enquanto o teclado está aberto. Usado pra trocar a folga de baixo da
// tela: com o teclado fechado a tela precisa respeitar os botões do sistema
// (insets.bottom); com o teclado aberto ele já cobre essa área.
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
