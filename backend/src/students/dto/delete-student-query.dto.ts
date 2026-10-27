import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteStudentQueryDto {
  @ApiProperty({
    description:
      'Nome completo do aluno digitado pelo admin — confirmação da exclusão definitiva',
  })
  @IsString()
  @IsNotEmpty()
  confirmName!: string;
}
