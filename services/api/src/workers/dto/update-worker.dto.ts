import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { EmploymentType, WorkerStatus } from '@buildtime/shared-types';

export class UpdateWorkerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsEnum(['regular', 'project-based', 'casual'] satisfies EmploymentType[])
  employmentType?: EmploymentType;

  @IsOptional() @IsNumber() @Min(0)
  dailyRate?: number;

  @IsOptional()
  @IsEnum(['active', 'inactive', 'terminated'] satisfies WorkerStatus[])
  status?: WorkerStatus;
}
