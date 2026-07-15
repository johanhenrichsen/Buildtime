import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class AttendanceEventsQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsUUID()
  workerId?: string;
}
