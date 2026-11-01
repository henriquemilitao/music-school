import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CIVIL_DATE_REGEX } from '../payment-edit.util';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    description: 'URL do comprovante, se o admin quiser anexar',
  })
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional({
    description:
      'Dia em que o pagamento foi feito (AAAA-MM-DD, não pode ser futuro). Sem isso vale agora.',
    example: '2026-10-28',
  })
  @IsOptional()
  @Matches(CIVIL_DATE_REGEX, { message: 'paidAt deve ser AAAA-MM-DD' })
  paidAt?: string;
}
