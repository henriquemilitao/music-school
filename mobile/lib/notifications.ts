// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Define como a notificação se comporta quando o app está ABERTO (foreground).
// Sem isso, notificações chegando com o app aberto não mostram nada na tela.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  // Canal de notificação é obrigatório no Android 8+.
  // Sem um canal configurado, a notificação pode nem aparecer.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  // Push só funciona em device físico — emulador não recebe push de verdade.
  if (!Device.isDevice) {
    console.log(
      'Push notifications só funcionam em device físico, não em emulador.',
    );
    return null;
  }

  // Verifica se já tem permissão; se não tem, pede.
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Usuário negou permissão de notificação.');
    return null;
  }

  // projectId vem do app.json/eas.json — gerado quando você rodou "eas build:configure".
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.log('projectId não encontrado — confira o app.json');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data; // formato: "ExponentPushToken[xxxxxxxxxxxx]"
  } catch (error) {
    console.log('Erro ao gerar push token:', error);
    return null;
  }
}
