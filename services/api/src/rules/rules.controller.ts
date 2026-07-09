import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { RulesService } from './rules.service';

@Controller('rules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post('compute-dtr/:cutoffId')
  @RequirePermissions('run_payroll')
  computeDtr(@Param('cutoffId', ParseUUIDPipe) cutoffId: string) {
    return this.rulesService.computeDtr(cutoffId);
  }
}
