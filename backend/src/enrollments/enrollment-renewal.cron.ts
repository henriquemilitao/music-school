import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnrollmentsService } from './enrollments.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EnrollmentRenewalCron {
  private readonly logger = new Logger(EnrollmentRenewalCron.name);

  constructor(
    private enrollmentsService: EnrollmentsService,
    private config: ConfigService,
  ) {}

  // roda todo dia à meia-noite — gera faturas/aulas do próximo período
  // ~10 dias antes do 1º dia de aula (que agora é a dueDate)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRenewal() {
    this.logger.log('Verificando matrículas para renovação...');

    const daysBeforeStart = this.config.get<number>(
      'RENEWAL_DAYS_BEFORE_START',
      10,
    );
    const results = await this.enrollmentsService.renewDueSoon(daysBeforeStart);

    if (results.length > 0) {
      this.logger.log(
        `Renovadas ${results.length} matrículas: ${JSON.stringify(results)}`,
      );
    } else {
      this.logger.log('Nenhuma matrícula precisou ser renovada');
    }
  }

  // roda logo depois (00:05) — marca como OVERDUE toda fatura PENDING
  // cuja dueDate já passou. Separado do job de renovação por clareza
  // de responsabilidade (gerar fatura != marcar atraso), mesmo rodando
  // quase junto.
  @Cron('5 0 * * *')
  async handleOverdue() {
    this.logger.log('Verificando pagamentos em atraso...');

    const { updatedCount } =
      await this.enrollmentsService.markOverduePayments();

    if (updatedCount > 0) {
      this.logger.log(`${updatedCount} pagamento(s) marcado(s) como OVERDUE`);
    } else {
      this.logger.log('Nenhum pagamento novo em atraso');
    }
  }
}
