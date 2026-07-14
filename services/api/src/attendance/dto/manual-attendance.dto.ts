import { IsEnum, IsUUID } from 'class-validator';
import { EventType } from '@buildtime/shared-types';

export class ManualAttendanceDto {
  @IsUUID()
  workerId: string;

  @IsEnum(['in', 'out'] satisfies EventType[])
  eventType: EventType;

  @IsUUID()
  siteId: string;
}
