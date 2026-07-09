import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateDtrDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  regularHrs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  otHrs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nightDiffHrs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lateMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  undertimeMin?: number;

  @IsString()
  @MinLength(1)
  reason: string;
}
