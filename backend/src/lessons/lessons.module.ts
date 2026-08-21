import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { LessonCompletionCron } from './lesson-completion.cron'; // NOVO

@Module({
  controllers: [LessonsController],
  providers: [LessonsService, LessonCompletionCron], // adiciona o cron aqui
  exports: [LessonsService],
})
export class LessonsModule {}
