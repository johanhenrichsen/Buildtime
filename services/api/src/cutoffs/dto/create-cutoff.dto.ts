import { IsISO8601 } from 'class-validator';

export class CreateCutoffDto {
  @IsISO8601()
  periodStart: string;

  @IsISO8601()
  periodEnd: string;
}
