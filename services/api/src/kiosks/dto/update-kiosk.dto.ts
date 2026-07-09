import { IsEnum, IsOptional } from 'class-validator';
import { KioskStatus } from '@buildtime/shared-types';

export class UpdateKioskDto {
  @IsOptional()
  @IsEnum(['active', 'inactive', 'maintenance'] satisfies KioskStatus[])
  status?: KioskStatus;
}
