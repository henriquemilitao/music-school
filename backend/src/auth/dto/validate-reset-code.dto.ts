import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateResetCodeDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  code!: string;
}
