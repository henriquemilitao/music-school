import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Encerrar a matrícula "a partir de uma aula": essa aula e as seguintes
// somem; as anteriores ficam no histórico. Sem `fromLessonId`, vale a
// partir de agora.
export class EndEnrollmentDto {
  @ApiPropertyOptional({ description: 'Primeira aula que deixa de acontecer' })
  @IsOptional()
  @IsUUID()
  fromLessonId?: string;
}

export class EndPreviewQueryDto {
  @ApiPropertyOptional({ description: 'Primeira aula que deixa de acontecer' })
  @IsOptional()
  @IsUUID()
  fromLessonId?: string;
}
