import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkerJwtPayload } from '@buildtime/shared-types';
import { DtrService } from './dtr.service';
import { UpdateDtrDto } from './dto/update-dtr.dto';

@Controller('dtr')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DtrController {
  constructor(private readonly dtrService: DtrService) {}

  @Get('export')
  @RequirePermissions('edit_attendance')
  export(@Query('cutoffId') cutoffId: string) {
    return this.dtrService.exportByCutoff(cutoffId);
  }

  @Get()
  @RequirePermissions('edit_attendance')
  findByCutoff(
    @Query('cutoffId') cutoffId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dtrService.findByCutoff(cutoffId, {
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Patch(':id')
  @RequirePermissions('edit_attendance')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDtrDto,
    @CurrentUser() user: WorkerJwtPayload,
  ) {
    return this.dtrService.update(id, dto, user);
  }
}
