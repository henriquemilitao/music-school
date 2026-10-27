import {
  IsDecimal,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument } from '@prisma/client';

// Edição da matrícula (admin). Todos os campos são opcionais: só o que vier
// é alterado.
export class UpdateEnrollmentDto {
  @ApiPropertyOptional({
    enum: Instrument,
    description: 'Instrumento (fica no cadastro do aluno)',
  })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;

  @ApiPropertyOptional({
    description:
      'Novo professor — também passa para as aulas futuras agendadas',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    example: '250.00',
    description: 'Novo valor da mensalidade — vale para as PRÓXIMAS faturas',
  })
  @IsOptional()
  @IsDecimal()
  monthlyAmount?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: '0=domingo ... 6=sábado', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekDay?: number;

  @ApiPropertyOptional({ example: '15:30' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description:
      'Obrigatório quando dia, horário ou duração mudam e existem aulas futuras: a partir de qual aula o novo horário vale (ela e as seguintes são atualizadas; as anteriores ficam como estão)',
  })
  @IsOptional()
  @IsUUID()
  applyFromLessonId?: string;

  @ApiPropertyOptional({
    description:
      'Novo dia do mês do vencimento (1-31) — vale para as próximas faturas geradas',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  paymentDueDay?: number;
}
