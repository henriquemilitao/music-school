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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument, LessonStatus } from '@prisma/client';
import {
  LESSON_CANCEL_REASON_MAX_LENGTH,
  LESSON_MAX_DURATION_MINUTES,
  LESSON_MIN_DURATION_MINUTES,
  LESSON_NOTES_MAX_LENGTH,
} from '../lessons.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// PATCH /lessons/:id — tudo opcional: só o que vier no body é alterado.
export class UpdateLessonDto {
  @ApiPropertyOptional({ enum: LessonStatus })
  @IsOptional()
  @IsEnum(LessonStatus)
  status?: LessonStatus;

  // Ausente no body → não mexe nas anotações. "" ou null → apaga.
  @ApiPropertyOptional({
    description:
      'Anotações da aula (o que foi trabalhado, o que estudar). Visíveis pro aluno. Envie null ou "" pra apagar.',
    maxLength: LESSON_NOTES_MAX_LENGTH,
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(LESSON_NOTES_MAX_LENGTH, {
    message: `As anotações podem ter no máximo ${LESSON_NOTES_MAX_LENGTH} caracteres`,
  })
  notes?: string | null;

  @ApiPropertyOptional({
    description:
      'Motivo do cancelamento (opcional). Só vale com status CANCELLED.',
    maxLength: LESSON_CANCEL_REASON_MAX_LENGTH,
    nullable: true,
    type: String,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(LESSON_CANCEL_REASON_MAX_LENGTH)
  cancelReason?: string | null;

  @ApiPropertyOptional({
    description: 'Nova data e hora da aula (ISO, instante UTC)',
    example: '2026-11-04T19:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsInt()
  @Min(LESSON_MIN_DURATION_MINUTES)
  @Max(LESSON_MAX_DURATION_MINUTES)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Professor da aula. null = sem professor.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string | null;

  @ApiPropertyOptional({
    enum: Instrument,
    nullable: true,
    description: 'Instrumento da aula. null = volta a seguir o do aluno.',
  })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument | null;

  @ApiPropertyOptional({ description: 'true = aula de reposição' })
  @IsOptional()
  @IsBoolean()
  isMakeup?: boolean;

  @ApiPropertyOptional({
    description:
      'Aula (do mesmo aluno) que esta aula repõe. Implica isMakeup. null = sem vínculo.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsUUID()
  makeupForLessonId?: string | null;
}
