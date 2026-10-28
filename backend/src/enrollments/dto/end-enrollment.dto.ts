import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Encerrar a matrícula "a partir de uma aula": essa aula e as seguintes são
// CANCELADAS (continuam no histórico); as anteriores ficam como estão. Sem
// `fromLessonId`, vale a partir de agora.
export class EndEnrollmentDto {
  @ApiPropertyOptional({ description: 'Primeira aula que deixa de acontecer' })
  @IsOptional()
  @IsUUID()
  fromLessonId?: string;

  @ApiPropertyOptional({
    description:
      'Faturas (listadas no end-preview) que o admin quer APAGAR. As demais ficam. Apagar uma fatura paga equivale a estornar.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  deletePaymentIds?: string[];
}

export class EndPreviewQueryDto {
  @ApiPropertyOptional({ description: 'Primeira aula que deixa de acontecer' })
  @IsOptional()
  @IsUUID()
  fromLessonId?: string;
}
