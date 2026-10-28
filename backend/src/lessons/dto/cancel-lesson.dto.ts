import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument } from '@prisma/client';
import {
  LESSON_CANCEL_REASON_MAX_LENGTH,
  LESSON_MAX_DURATION_MINUTES,
  LESSON_MIN_DURATION_MINUTES,
} from '../lessons.constants';

// Reposição marcada já no ato do cancelamento. Tudo que não vier herda da
// aula cancelada (professor, duração, instrumento, matrícula).
export class MakeupInputDto {
  @ApiPropertyOptional({ example: '2026-11-04T19:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(LESSON_MIN_DURATION_MINUTES)
  @Max(LESSON_MAX_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ enum: Instrument })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;
}

export class CancelLessonDto {
  @ApiPropertyOptional({
    description: 'Motivo do cancelamento (opcional)',
    maxLength: LESSON_CANCEL_REASON_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(LESSON_CANCEL_REASON_MAX_LENGTH)
  cancelReason?: string;

  @ApiPropertyOptional({
    description:
      'Se informado, cria a aula de reposição junto com o cancelamento (numa só operação).',
    type: MakeupInputDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MakeupInputDto)
  makeup?: MakeupInputDto;
}
