import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Instrument } from '@prisma/client';

export class CreateStudentDto {
  @ApiProperty({ description: 'Id do User ao qual esse Student pertence' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ description: 'Nome', example: 'Renato' })
  @IsString()
  name: string; // nome do aluno, obrigatório

  @ApiProperty({ description: 'Data de Nascimento', example: '2012-05-09' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ enum: Instrument, default: Instrument.PIANO })
  @IsOptional()
  @IsEnum(Instrument)
  instrument?: Instrument;

  @ApiPropertyOptional({ example: 'Tem dificuldade com pestanas' })
  @IsOptional()
  @IsString()
  notes?: string;
}
