import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument, LessonStatus } from '@prisma/client';
import {
  LESSON_BULK_MAX,
  LESSON_CANCEL_REASON_MAX_LENGTH,
  LESSON_MAX_DURATION_MINUTES,
  LESSON_MAX_SHIFT_DAYS,
  LESSON_MIN_DURATION_MINUTES,
} from '../lessons.constants';

// O que muda em TODAS as aulas escolhidas. Só vale o que vier no body.
export class BulkLessonChangesDto {
  @ApiPropertyOptional({ enum: LessonStatus })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  @ApiPropertyOptional({ maxLength: LESSON_CANCEL_REASON_MAX_LENGTH })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(LESSON_CANCEL_REASON_MAX_LENGTH)
  cancelReason?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({ enum: Instrument })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(LESSON_MIN_DURATION_MINUTES)
  @Max(LESSON_MAX_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description:
      'Desloca cada aula N dias (negativo = pra trás). Segunda → quarta = 2.',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(-LESSON_MAX_SHIFT_DAYS)
  @Max(LESSON_MAX_SHIFT_DAYS)
  shiftDays?: number;

  @ApiPropertyOptional({
    description: 'Novo horário de todas as aulas, "HH:mm" (hora da escola)',
    example: '15:30',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'Horário inválido (use HH:mm)',
  })
  startTime?: string;
}

export class BulkUpdateLessonsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LESSON_BULK_MAX)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  lessonIds!: string[];

  @ApiProperty({ type: BulkLessonChangesDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => BulkLessonChangesDto)
  changes!: BulkLessonChangesDto;
}

export class BulkDeleteLessonsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LESSON_BULK_MAX)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  lessonIds!: string[];
}
