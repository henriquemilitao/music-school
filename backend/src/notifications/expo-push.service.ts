// backend/src/notifications/expo-push.service.ts
//
// Fala direto com a API HTTP do Expo (https://exp.host/--/api/v2/push/send).
// Não precisa de SDK nem de credencial — o Expo já cuida de rotear
// pra APNs (iOS) ou FCM (Android) por trás. É o jeito mais simples
// de mandar push a partir de um app criado com Expo/EAS.
import { Injectable, Logger } from '@nestjs/common';

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  badge?: number;
  data?: Record<string, unknown>;
  sound?: 'default';
};

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  // Expo aceita até 100 mensagens por request — respeitamos isso
  // fatiando em lotes, embora na prática dificilmente vamos passar
  // disso no cron diário de uma escola de música.
  private readonly BATCH_SIZE = 100;

  async sendBatch(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const validMessages = messages.filter((m) =>
      m.to?.startsWith('ExponentPushToken'),
    );

    if (validMessages.length === 0) {
      this.logger.warn(
        'Nenhum token válido no lote — pulando envio (todos nulos ou malformados)',
      );
      return;
    }

    for (let i = 0; i < validMessages.length; i += this.BATCH_SIZE) {
      const chunk = validMessages.slice(i, i + this.BATCH_SIZE);
      await this.sendChunk(chunk);
    }
  }

  private async sendChunk(chunk: ExpoPushMessage[]): Promise<void> {
    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      this.logger.log(`Resposta da Expo Push API: ${JSON.stringify(result)}`);

      if (!response.ok) {
        this.logger.error(
          `Expo Push API retornou erro HTTP ${response.status}: ${JSON.stringify(result)}`,
        );
        return;
      }

      // A resposta traz um "ticket" por mensagem, na mesma ordem do
      // request. status: 'error' aqui geralmente significa token
      // inválido/expirado (DeviceNotRegistered) — logamos mas não
      // derrubamos o cron por causa de 1 token ruim.
      const tickets = result?.data as
        { status: string; message?: string; details?: unknown }[] | undefined;

      tickets?.forEach((ticket, idx) => {
        if (ticket.status === 'error') {
          this.logger.warn(
            `Push falhou pra token ${chunk[idx].to}: ${ticket.message}`,
          );
        }
      });
    } catch (error) {
      this.logger.error('Erro ao chamar a Expo Push API', error);
    }
  }
}
