import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { EmploymentType, WorkerStatus } from '@buildtime/shared-types';

export class UpdateWorkerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsEnum(['regular', 'project-based', 'casual'] satisfies EmploymentType[])
  employmentType?: EmploymentType;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  dailyRate?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'terminated'] satisfies WorkerStatus[])
  status?: WorkerStatus;

  @IsOptional() @ValidateIf(o => o.photo !== null) @IsString()
  photo?: string | null;
}
