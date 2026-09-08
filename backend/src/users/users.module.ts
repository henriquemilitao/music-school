import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../auth/auth.module';
import { EnrollmentsModule } from 'src/enrollments/enrollments.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [AuthModule, EnrollmentsModule, EmailModule], // pra usar AuthService.createInvite() no create()
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
