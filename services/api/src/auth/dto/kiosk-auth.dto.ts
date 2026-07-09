import { IsString, MinLength } from 'class-validator';

export class KioskAuthDto {
  @IsString()
  @MinLength(16)
  deviceKey: string;
}
