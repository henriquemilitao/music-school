import { Controller, Post } from '@nestjs/common';
import { PaymentRemindersService } from './payment-reminders.service';

// payment-reminders.controller.ts (temporário, remove depois)
@Controller('debug')
export class DebugController {
  constructor(private reminders: PaymentRemindersService) {}

  @Post('trigger-reminders')
  async trigger() {
    await this.reminders.sendDailyPaymentReminders();
    return { status: 'disparado' };
  }
}
