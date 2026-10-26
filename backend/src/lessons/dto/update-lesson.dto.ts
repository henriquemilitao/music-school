import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus } from '@prisma/client';
import { LESSON_NOTES_MAX_LENGTH } from '../lessons.constants';

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
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(LESSON_NOTES_MAX_LENGTH, {
    message: `As anotações podem ter no máximo ${LESSON_NOTES_MAX_LENGTH} caracteres`,
  })
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Motivo do cancelamento' })
  @IsOptional()
  @IsString()
  cancelReason?: string;
}
