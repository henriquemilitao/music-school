import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Como encerrar a matrícula
export enum EndMode {
  // Agora: todas as aulas agendadas a partir de agora são canceladas
  NOW = 'NOW',
  // A partir de uma aula: ela e as seguintes são canceladas
  FROM_LESSON = 'FROM_LESSON',
  // Ao fim de uma fatura: aulas depois do período dela são canceladas e as
  // faturas seguintes são apagadas
  AFTER_INVOICE = 'AFTER_INVOICE',
}

export class EndPreviewQueryDto {
  @ApiProperty({ enum: EndMode })
  @IsEnum(EndMode)
  mode!: EndMode;

  @ApiPropertyOptional({
    description: 'FROM_LESSON: primeira aula que deixa de acontecer',
  })
  @IsOptional()
  @IsUUID()
  fromLessonId?: string;

  @ApiPropertyOptional({
    description: 'AFTER_INVOICE: fatura em cujo fim a matrícula encerra',
  })
  @IsOptional()
  @IsUUID()
  afterPaymentId?: string;
}

// Aulas canceladas continuam no histórico. Faturas: em NOW/FROM_LESSON o admin
// escolhe quais apagar (`deletePaymentIds`); em AFTER_INVOICE as seguintes à
// escolhida são apagadas.
export class EndEnrollmentDto extends EndPreviewQueryDto {
  @ApiPropertyOptional({
    description:
      'NOW/FROM_LESSON: faturas (listadas no end-preview) que o admin quer APAGAR. Apagar uma fatura paga equivale a estornar.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  deletePaymentIds?: string[];

  @ApiPropertyOptional({
    description:
      'Faturas em aberto (listadas no end-preview) que o admin já recebeu: passam a PAGAS.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  markPaidPaymentIds?: string[];
}
