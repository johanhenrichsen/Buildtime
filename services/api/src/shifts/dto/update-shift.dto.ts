import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class UpdateShiftDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm' })
  startTime?: string;

  @IsOptional() @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm' })
  endTime?: string;

  @IsOptional() @IsInt() @Min(0) @Max(120)
  graceMinutes?: number;
}
