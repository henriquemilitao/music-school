import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentRenewalCron } from './enrollment-renewal.cron';

@Module({
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentRenewalCron],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
