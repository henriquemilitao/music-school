import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Quanto do fim da tela o teclado está cobrindo (em dp); 0 com o teclado
// fechado. Serve pra colocar um padding no fim da tela e fazer o rodapé
// subir junto com o teclado.
//
// Feito à mão (em vez de KeyboardAvoidingView) pra que, ao fechar o
// teclado, o valor volte a 0 de forma garantida e o rodapé fique só acima
// dos botões do sistema, sem sobrar espaço vazio.
export function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (event) => {
      const { screenY, height } = event.endCoordinates;
      // Distância entre o topo do teclado e o fim da tela; se o sistema
      // não informar a posição, usa a altura reportada.
      const fromTop = Dimensions.get('screen').height - screenY;
      setOverlap(Math.max(0, fromTop > 0 ? fromTop : height));
    });
    const hide = Keyboard.addListener(hideEvent, () => setOverlap(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return overlap;
}
