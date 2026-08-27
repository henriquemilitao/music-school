// backend/src/users/dto/create-student-with-enrollment.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument } from '@prisma/client';
import { CreateEnrollmentForStudentDto } from './create-enrollment-for-student.dto';

export class CreateStudentWithEnrollmentDto {
  @ApiProperty({
    description:
      'Nome do aluno (pode ser diferente do nome do responsável, ex: filho)',
    example: 'João Silva',
  })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Data de nascimento do aluno',
    example: '2015-03-20',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Instrument, example: Instrument.PIANO })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;

  @ApiPropertyOptional({ example: 'Prefere aulas à tarde' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description:
      'Dados da matrícula (horário, professor, valor) — sempre obrigatória',
    type: () => CreateEnrollmentForStudentDto,
  })
  @ValidateNested()
  @Type(() => CreateEnrollmentForStudentDto)
  enrollment!: CreateEnrollmentForStudentDto;
}
