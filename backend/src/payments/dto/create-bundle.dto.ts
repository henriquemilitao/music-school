import { ArrayMinSize, IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBundleDto {
  @ApiProperty({
    type: [String],
    description: 'IDs das faturas (Payment) a serem pagas juntas — mínimo 2',
  })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  paymentIds: string[];
}
