import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SchedulePreviewQueryDto {
  @ApiProperty({ description: 'Aula a partir da qual o novo horário vale' })
  @IsUUID()
  fromLessonId!: string;

  @ApiPropertyOptional({ description: '0=domingo ... 6=sábado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  weekDay?: number;

  @ApiPropertyOptional({ example: '15:30' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'startTime deve estar no formato HH:MM',
  })
  startTime?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  durationMinutes?: number;
}
