import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentRenewalCron } from './enrollment-renewal.cron';
import { EnrollmentManagementService } from './enrollment-management.service';

@Module({
  controllers: [EnrollmentsController],
  providers: [
    EnrollmentsService,
    EnrollmentManagementService,
    EnrollmentRenewalCron,
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
