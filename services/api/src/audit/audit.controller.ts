import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { AuditService } from './audit.service';

@Controller('audit-log')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('manage_workers_all')
  findAll(
    @Query('entity')   entity?:   string,
    @Query('entityId') entityId?: string,
    @Query('actorId')  actorId?:  string,
    @Query('page')     page?:     string,
    @Query('limit')    limit?:    string,
  ) {
    return this.auditService.findAll({
      entity,
      entityId,
      actorId,
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
