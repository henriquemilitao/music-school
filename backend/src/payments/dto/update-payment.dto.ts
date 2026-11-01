import { IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CIVIL_DATE_REGEX } from '../payment-edit.util';

export const PAYMENT_MAX_AMOUNT = 100_000;

// PATCH /payments/:id — tudo opcional: só o que vier no body é alterado.
export class UpdatePaymentDto {
  @ApiPropertyOptional({ description: 'Novo valor da mensalidade (R$)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(PAYMENT_MAX_AMOUNT)
  amount?: number;

  @ApiPropertyOptional({ description: 'Novo vencimento (AAAA-MM-DD)' })
  @IsOptional()
  @Matches(CIVIL_DATE_REGEX, { message: 'dueDate deve ser AAAA-MM-DD' })
  dueDate?: string;

  @ApiPropertyOptional({
    description:
      'Novo início do período de aulas (AAAA-MM-DD); o fim acompanha (1 mês depois, menos um dia)',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_REGEX, { message: 'periodStart deve ser AAAA-MM-DD' })
  periodStart?: string;

  @ApiPropertyOptional({
    description:
      'Dia do pagamento (AAAA-MM-DD, não pode ser futuro) — só em fatura paga',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_REGEX, { message: 'paidAt deve ser AAAA-MM-DD' })
  paidAt?: string;
}
