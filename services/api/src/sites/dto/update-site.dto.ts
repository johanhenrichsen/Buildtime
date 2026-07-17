import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { SiteStatus } from '@buildtime/shared-types';

export class UpdateSiteDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  geoLat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  geoLng?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive'] satisfies SiteStatus[])
  status?: SiteStatus;

  @IsOptional() @IsUUID()
  shiftId?: string;
}
