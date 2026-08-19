// backend/src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { ExpoPushService } from './expo-push.service';
import { PaymentRemindersService } from './payment-reminders.service';
import { DebugController } from './payment-reminders.controller';

@Module({
  providers: [ExpoPushService, PaymentRemindersService],
  exports: [ExpoPushService],
  controllers: [DebugController],
})
export class NotificationsModule {}
