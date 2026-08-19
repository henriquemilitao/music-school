// backend/src/users/dto/update-push-token.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString()
  @IsNotEmpty()
  pushToken: string;
}
