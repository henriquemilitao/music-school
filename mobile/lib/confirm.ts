import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
};

// Pergunta de confirmação que funciona em todas as plataformas e devolve
// true/false. O Alert.alert não faz nada no react-native-web, então na
// web cai pro window.confirm do navegador — sem isso a confirmação
// ficaria travada quando o app roda com `start:web`.
export function confirmAsync({
  title,
  message,
  confirmText,
  cancelText = 'Voltar',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(
      window.confirm(message ? `${title}\n\n${message}` : title),
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
