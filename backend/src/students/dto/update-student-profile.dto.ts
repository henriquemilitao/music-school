import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Edição dos dados cadastrais pelo admin: aluno + responsável (titular da
// conta). Só o que vier é alterado. O instrumento NÃO está aqui — ele é
// editado junto da matrícula (PATCH /enrollments/:id).
export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do aluno' })
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '2014-07-10' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do responsável' })
  @MaxLength(120)
  guardianName?: string;

  @ApiPropertyOptional({ example: 'maria@email.com' })
  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @ApiPropertyOptional({
    example: '67999999999',
    description: 'String vazia remove o telefone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  guardianPhone?: string;
}
