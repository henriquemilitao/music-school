import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPasswordDto {
  @ApiProperty({ example: 'a1b2c3...' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'minhaSenha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
