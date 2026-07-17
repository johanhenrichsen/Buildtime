import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateShiftDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:mm' })
  startTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:mm' })
  endTime: string;

  @IsInt() @Min(0) @Max(120)
  graceMinutes: number;
}
