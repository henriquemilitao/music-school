import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const PAYMENT_CANCEL_REASON_MAX_LENGTH = 200;

export class CancelPaymentDto {
  @ApiPropertyOptional({
    description: 'Por que a fatura foi anulada (só o admin vê)',
    maxLength: PAYMENT_CANCEL_REASON_MAX_LENGTH,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(PAYMENT_CANCEL_REASON_MAX_LENGTH)
  reason?: string;
}
