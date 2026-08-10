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

export class CreateEnrollmentDto {
  @ApiProperty({ description: 'ID do Student' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ description: 'ID do Teacher (opcional)' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiProperty({ description: 'Horário no formato HH:MM', example: '15:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationMinutes?: number;

  @ApiProperty({ description: 'Valor da mensalidade', example: '200.00' })
  @IsDecimal()
  monthlyAmount!: string;

  @ApiProperty({ description: 'Data da primeira aula', example: '2026-07-09' })
  @IsDateString()
  startDate!: string;

  // frequency removido do DTO por enquanto -- MVP fixa em WEEKLY no
  // service. Reintroduzir quando BIWEEKLY tiver uma lógica de
  // intervalo real (a atual, por index par/impar, não garante 15 dias)

  @ApiPropertyOptional({
    description:
      'Se true, a primeira mensalidade já nasce como PAGA (ex: aluno pagou presencialmente na matrícula). Default: false (nasce PENDING/OVERDUE conforme a data)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  firstPaymentPaid?: boolean;
}
