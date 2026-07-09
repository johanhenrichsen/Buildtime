import { IsEnum, IsString, MinLength } from 'class-validator';

export class ReviewEventDto {
  @IsEnum(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsString()
  @MinLength(1)
  reason: string;
}
