// backend/src/users/dto/create-full-user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CreateStudentWithEnrollmentDto } from './create-student-with-enrollment.dto';

export class CreateFullUserDto {
  @ApiProperty({
    description: 'Nome do titular da conta (quem faz login no app)',
    example: 'Maria Silva',
  })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'maria@email.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '11999999999' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    enum: Role,
    default: Role.STUDENT,
    description: 'Tipo de acesso do titular da conta',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiProperty({
    description:
      'Lista de alunos vinculados a essa conta. Se o titular for ele mesmo o aluno, inclua um item aqui com o mesmo nome. Se for responsável de 1+ filhos, um item por filho. Pode ser ambos ao mesmo tempo.',
    type: () => CreateStudentWithEnrollmentDto,
    isArray: true,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateStudentWithEnrollmentDto)
  @ArrayMinSize(1)
  students!: CreateStudentWithEnrollmentDto[];
}
