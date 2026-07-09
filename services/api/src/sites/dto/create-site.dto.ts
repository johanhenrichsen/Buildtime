import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsNumber() @Min(-90) @Max(90)
  geoLat?: number;

  @IsOptional() @IsNumber() @Min(-180) @Max(180)
  geoLng?: number;
}
