import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { GuardiansModule } from './guardians/guardians.module';
import { LessonsModule } from './lessons/lessons.module';
import { PaymentsModule } from './payments/payments.module';
import { EnrollmentsModule } from './enrollments/enrollments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carrega o .env globalmente
    ScheduleModule.forRoot(), // adiciona
    PrismaModule,
    AuthModule,
    UsersModule,
    SchoolsModule,
    StudentsModule,
    TeachersModule,
    GuardiansModule,
    LessonsModule,
    PaymentsModule,
    EnrollmentsModule,
    NotificationsModule, // NOVO
  ],
})
export class AppModule {}
