import { IsNumber, IsPositive, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateCashAdvanceDto {
  @IsUUID()
  workerId: string;

  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @IsString()
  @MaxLength(500)
  reason: string;
}
