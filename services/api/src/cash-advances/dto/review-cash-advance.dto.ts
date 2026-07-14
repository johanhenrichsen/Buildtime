import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCashAdvanceDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
