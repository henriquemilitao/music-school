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
  if (!Device.isDevice) {
    console.log('Push notifications só funcionam em device físico.');
    return null;
  }

  // 1. Solicita a permissão primeiro
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

  // 2. Registra o canal com importância Máxima para o Android exibir o banner
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Padrão',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#B08D57',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.log('projectId não encontrado — confira o app.config.js');
    return null;
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return tokenResponse.data;
  } catch (error) {
    console.log('Erro ao gerar push token:', error);
    return null;
  }
}

export function subscribeToPushTokenChanges(
  onTokenChange: (token: string) => void,
) {
  const subscription = Notifications.addPushTokenListener((event) => {
    console.log('Push token mudou, revalidando:', event.data);
    onTokenChange(event.data);
  });

  return () => subscription.remove();
}
