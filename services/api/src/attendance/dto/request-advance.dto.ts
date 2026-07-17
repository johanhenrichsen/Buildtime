import { IsNumber, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';

export class RequestAdvanceDto {
  @IsUUID()
  workerId: string;

  @IsNumber()
  @Min(1)
  @Max(500_000)
  amount: number;

  @IsString()
  @MinLength(5)
  reason: string;
}
