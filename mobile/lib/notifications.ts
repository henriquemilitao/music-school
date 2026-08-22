// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    console.log(
      'Push notifications só funcionam em device físico, não em emulador.',
    );
    return null;
  }

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

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.log('projectId não encontrado — confira o app.config.js');
    return null;
  }

  try {
    // IMPORTANTE: força buscar/revalidar o token toda vez, não
    // confia só no cache do SDK — é isso que garante que, depois de
    // um rebuild/reinstall, a gente pegue o token realmente vÃ¡lido
    // no FCM, não um cache morto.
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (error) {
    console.log('Erro ao gerar push token:', error);
    return null;
  }
}

// NOVO — registra um listener que dispara toda vez que o SDK nativo
// detecta que o token FCM mudou por baixo dos panos (rebuild, app
// reinstalado, credenciais do Firebase trocadas, etc). Sem isso, o
// app só busca o token uma vez no login e nunca mais reconfirma —
// exatamente o bug que causou o DeviceNotRegistered.
export function subscribeToPushTokenChanges(
  onTokenChange: (token: string) => void,
) {
  const subscription = Notifications.addPushTokenListener((event) => {
    console.log('Push token mudou, revalidando:', event.data);
    onTokenChange(event.data);
  });

  return () => subscription.remove();
}
