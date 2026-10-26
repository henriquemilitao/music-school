import {
  IsUUID,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LESSON_NOTES_MAX_LENGTH } from '../lessons.constants';

export class CreateLessonDto {
  @ApiProperty({ description: 'ID do Student' })
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional({ description: 'ID do Teacher' })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @ApiPropertyOptional({
    description:
      'ID do Enrollment (se for aula de reposição vinculada a uma matrícula)',
  })
  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @ApiProperty({
    description: 'Data e hora da aula',
    example: '2026-07-10T15:00:00',
  })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'true = aula de reposição' })
  @IsOptional()
  @IsBoolean()
  isMakeup?: boolean;

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
