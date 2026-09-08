import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @ApiProperty({ example: 'minhaSenha123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
