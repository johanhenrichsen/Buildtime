import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { EventType, MatchMethod } from '@buildtime/shared-types';

export class PendingEventDto {
  @IsUUID()
  clientEventId: string;

  @IsUUID()
  workerId: string;

  @IsEnum(['in', 'out'] satisfies EventType[])
  eventType: EventType;

  @IsISO8601()
  clientTs: string;

  @IsNumber() @Min(0) @Max(1)
  confidenceScore: number;

  @IsEnum(['face', 'face_low_confidence', 'manual_exception'] satisfies MatchMethod[])
  matchMethod: MatchMethod;

  @IsBoolean()
  flaggedForReview: boolean;
}

export class SyncEventsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PendingEventDto)
  events: PendingEventDto[];
}
