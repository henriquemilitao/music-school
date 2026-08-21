// lessons/lesson-completion.cron.ts — arquivo novo
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LessonsService } from './lessons.service';

@Injectable()
export class LessonCompletionCron {
  private readonly logger = new Logger(LessonCompletionCron.name);

  constructor(private lessonsService: LessonsService) {}

  // roda a cada 15 minutos — marca como COMPLETED toda aula SCHEDULED
  // cujo horário de término já passou. Não precisa ser em tempo real:
  // o frontend já calcula "aula em andamento/terminada" sozinho pro
  // card do dashboard; esse cron só mantém o banco consistente pra
  // telas de admin/histórico.

  // @Cron('0 */5 * * * *') // a cada 5 minutos
  // @Cron('0 */1 * * * *') // a cada 1 minuto
  // @Cron('*/30 * * * * *') // a cada 30 segundos
  // @Cron('*/10 * * * * *') // a cada 10 segundos (bem agressivo, só pra debug rápido)
  // @Cron('0 */15 * * * *') // a cada 15 minutos
  @Cron('0 */2 * * * *') // a cada 3 minutos
  async handleCompletion() {
    this.logger.log('Verificando aulas para marcar como concluídas...');

    const { updatedCount } = await this.lessonsService.markCompletedLessons();

    if (updatedCount > 0) {
      this.logger.log(`${updatedCount} aula(s) marcada(s) como COMPLETED`);
    } else {
      this.logger.log('Nenhuma aula precisou ser concluída');
    }
  }
}
