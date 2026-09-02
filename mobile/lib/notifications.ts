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

const projectId = Constants.expoConfig?.extra?.eas?.projectId;

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

// IMPORTANTE: addPushTokenListener dispara com o token NATIVO do
// sistema (FCM no Android, APNs no iOS) sempre que ele muda — NÃO é
// um Expo Push Token, mesmo vindo de dentro do expo-notifications.
// Se repassarmos event.data direto pro backend, sobrescrevemos o
// ExponentPushToken(...) correto com algo tipo
// "cFUr75KRRVGjiisqG955p6:APA91b..." (formato FCM), que o backend
// não reconhece e descarta ("Nenhum token válido no lote").
//
// Por isso, ao disparar esse listener, NÃO usamos event.data — pedimos
// de novo um Expo Push Token fresco via getExpoPushTokenAsync (que
// internamente já usa o token nativo atualizado por baixo dos panos).
export function subscribeToPushTokenChanges(
  onTokenChange: (token: string) => void,
) {
  const subscription = Notifications.addPushTokenListener(async (event) => {
    console.log(
      'Token nativo mudou — revalidando Expo Push Token (ignorando event.data, que é o token nativo)',
    );

    if (!projectId) {
      console.log('projectId não encontrado — confira o app.config.js');
      return;
    }

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      onTokenChange(tokenResponse.data);
    } catch (error) {
      console.log('Erro ao revalidar push token:', error);
    }
  });

  return () => subscription.remove();
}
