// backend/src/enrollments/enrollment-renewal.cron.ts
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

  // Roda todo dia à meia-noite. Verifica TODAS as matrículas ativas
  // e gera o próximo ciclo (aulas + fatura) pra quem estiver a
  // RENEWAL_DAYS_BEFORE_START dias ou menos do PRÓXIMO VENCIMENTO
  // (não do próximo início de aula — o gatilho é sempre o relógio
  // de pagamento, ver renewDueSoon no service).
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRenewal() {
    this.logger.log('Verificando matrículas para renovação...');

    // Lê do .env quantos dias de antecedência usar; se a variável
    // não estiver definida, cai no default de 10 (segundo parâmetro
    // do config.get).
    const daysBeforeStart = this.config.get<number>(
      'RENEWAL_DAYS_BEFORE_START',
      10,
    );

    // Dispara o trabalho pesado no service — devolve a lista de
    // matrículas que efetivamente geraram um novo período nessa
    // execução (pode vir vazia, se ninguém estava dentro da janela).
    const results = await this.enrollmentsService.renewDueSoon(daysBeforeStart);

    if (results.length > 0) {
      this.logger.log(
        `Renovadas ${results.length} matrículas: ${JSON.stringify(results)}`,
      );
    } else {
      this.logger.log('Nenhuma matrícula precisou ser renovada');
    }
  }

  // Roda logo depois (00:05) — marca como OVERDUE toda fatura
  // PENDING cuja dueDate já passou. Separado do job de renovação por
  // clareza de responsabilidade (gerar fatura != marcar atraso),
  // mesmo rodando quase junto.
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
