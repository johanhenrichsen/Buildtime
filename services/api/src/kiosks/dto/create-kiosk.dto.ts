import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateKioskDto {
  @IsUUID()
  siteId: string;

  @IsString()
  @MinLength(16)
  deviceKey: string;
}
