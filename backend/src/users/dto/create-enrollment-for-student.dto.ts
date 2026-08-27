// backend/src/users/dto/create-enrollment-for-student.dto.ts
import {
  IsUUID,
  IsInt,
  IsString,
  IsDateString,
  IsOptional,
  IsDecimal,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnrollmentForStudentDto {
  @ApiPropertyOptional({
    description: 'ID do professor responsável (opcional)',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ description: 'Horário no formato HH:MM', example: '15:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime!: string;

  @ApiPropertyOptional({ example: 60, minimum: 30 })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationMinutes?: number;

  @ApiProperty({ description: 'Valor da mensalidade', example: '250.00' })
  @IsDecimal()
  monthlyAmount!: string;

  @ApiProperty({
    description: 'Data da primeira aula (também é a dueDate da 1ª fatura)',
    example: '2026-09-01',
  })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({
    description:
      'Se true, a primeira mensalidade já nasce PAGA (ex: aluno pagou presencialmente na matrícula). Default: false',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  firstPaymentPaid?: boolean;
}
