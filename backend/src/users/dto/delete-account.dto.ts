import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ example: 'minhaSenha123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
