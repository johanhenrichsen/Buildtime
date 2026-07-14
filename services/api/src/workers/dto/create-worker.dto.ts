import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { EmploymentType } from '@buildtime/shared-types';

export class CreateWorkerDto {
  @IsString()
  employeeNo: string;

  @IsString()
  name: string;

  @IsUUID()
  roleId: string;

  @IsEnum(['regular', 'project-based', 'casual'] satisfies EmploymentType[])
  employmentType: EmploymentType;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyRate: number;

  @IsDateString()
  hireDate: string;

  @IsOptional()
  @IsEmail()
  @Transform(({ value }) => value === '' ? undefined : value)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
