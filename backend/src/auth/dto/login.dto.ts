import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@escolademo.com' })
  @IsEmail()
  email!: string; // "!" = definite assignment assertion — avisa ao TS que o
  // class-validator vai preencher isso antes de usar

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @MinLength(6)
  password!: string;
}
