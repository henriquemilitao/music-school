import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiPropertyOptional({
    description: 'URL do comprovante, se o admin quiser anexar',
  })
  @IsOptional()
  @IsString()
  proofUrl?: string;
}
