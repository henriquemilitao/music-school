// backend/src/users/dto/create-enrollment-for-student.dto.ts
import {
  IsUUID,
  IsInt,
  IsString,
  IsDateString,
  IsOptional,
  IsDecimal,
  IsBoolean,
  Min,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEnrollmentForStudentDto {
  // Professor responsável — opcional, pode ser atribuído depois.
  @ApiPropertyOptional({
    description: 'ID do professor responsável (opcional)',
  })
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  // Horário fixo de cada aula, formato "HH:MM".
  @ApiProperty({ description: 'Horário no formato HH:MM', example: '15:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime!: string;

  // Duração de cada aula, em minutos — default 60 se não informado
  // (aplicado no EnrollmentsService.create, não aqui no DTO).
  @ApiPropertyOptional({ example: 60, minimum: 30 })
  @IsOptional()
  @IsInt()
  @Min(30)
  durationMinutes?: number;

  // Valor cheio da mensalidade, sem desconto de pontualidade — como
  // string decimal pra evitar erro de arredondamento de ponto
  // flutuante que number/float teria com valores monetários.
  @ApiProperty({ description: 'Valor da mensalidade', example: '250.00' })
  @IsDecimal()
  monthlyAmount!: string;

  // Data da primeira aula — define o dia da semana das aulas
  // (weekDay) e o dia-âncora do ciclo mensal de aulas. Renomeado de
  // "startDate" pra deixar claro que é só sobre a AULA, não sobre
  // vencimento (ver firstPaymentDueDate abaixo).
  @ApiProperty({
    description: 'Data da primeira aula (define o dia da semana das aulas)',
    example: '2026-09-15',
  })
  @IsDateString()
  firstLessonDate!: string;

  // Data do primeiro vencimento da mensalidade — INDEPENDENTE de
  // firstLessonDate, pode ser uma data completamente diferente (ex:
  // aula começa dia 15, mas o combinado de pagamento é dia 10).
  // OPCIONAL: se não informado, o service usa firstLessonDate como
  // padrão (aula e vencimento nascem no mesmo dia nesse caso).
  @ApiPropertyOptional({
    description:
      'Data do primeiro vencimento da mensalidade. Se não informado, usa a mesma data de firstLessonDate como padrão.',
    example: '2026-09-10',
  })
  @IsOptional()
  @IsDateString()
  firstPaymentDueDate?: string;

  // Rótulo do mês desta fatura, formato "YYYY-MM". OPCIONAL: se não
  // informado, o service calcula automaticamente a partir do MÊS de
  // firstPaymentDueDate (ex: vence 10/09 → referenceMonth = "2026-09").
  // Existe pra cobrir o caso de um ciclo de aulas que atravessa a
  // virada do mês, onde não fica óbvio se a fatura é do mês de
  // início ou do mês de fim do ciclo — nesse caso o admin decide.
  @ApiPropertyOptional({
    description:
      'Rótulo do mês desta fatura no formato YYYY-MM (ex: "2026-09"). Se não informado, é calculado automaticamente a partir do mês de firstPaymentDueDate.',
    example: '2026-09',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'referenceMonth deve estar no formato YYYY-MM',
  })
  referenceMonth?: string;

  // Se true, a primeira mensalidade já nasce PAGA (ex: aluno pagou
  // presencialmente na matrícula). Default false.
  @ApiPropertyOptional({
    description:
      'Se true, a primeira mensalidade já nasce PAGA (ex: aluno pagou presencialmente na matrícula). Default: false',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  firstPaymentPaid?: boolean;
}
