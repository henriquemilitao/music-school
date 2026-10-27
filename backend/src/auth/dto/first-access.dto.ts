import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FirstAccessDto {
  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;
}
