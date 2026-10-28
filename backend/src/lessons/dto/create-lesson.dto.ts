import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument } from '@prisma/client';
import {
  LESSON_MAX_DURATION_MINUTES,
  LESSON_MIN_DURATION_MINUTES,
  LESSON_NOTES_MAX_LENGTH,
} from '../lessons.constants';

export class CreateLessonDto {
  @ApiProperty({ description: 'ID do Student' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ description: 'ID do Teacher' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description: 'ID do Enrollment (a aula entra no histórico dessa matrícula)',
  })
  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @ApiProperty({
    description: 'Data e hora da aula (ISO, instante UTC)',
    example: '2026-07-10T15:00:00.000Z',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(LESSON_MIN_DURATION_MINUTES)
  @Max(LESSON_MAX_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({
    enum: Instrument,
    description: 'Instrumento da aula. Omitido = segue o do aluno.',
  })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;

  @ApiPropertyOptional({ description: 'true = aula de reposição' })
  @IsOptional()
  @IsBoolean()
  isMakeup?: boolean;

  @ApiPropertyOptional({
    description:
      'Aula cancelada (do mesmo aluno) que esta aula repõe. Implica isMakeup.',
  })
  @IsOptional()
  @IsUUID()
  makeupForLessonId?: string;

  @ApiPropertyOptional({
    description: 'Anotações da aula (visíveis pro aluno)',
    maxLength: LESSON_NOTES_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(LESSON_NOTES_MAX_LENGTH, {
    message: `As anotações podem ter no máximo ${LESSON_NOTES_MAX_LENGTH} caracteres`,
  })
  notes?: string;
}
