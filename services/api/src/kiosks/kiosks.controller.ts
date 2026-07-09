import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '@buildtime/shared-types';
import { KiosksService } from './kiosks.service';
import { CreateKioskDto } from './dto/create-kiosk.dto';
import { UpdateKioskDto } from './dto/update-kiosk.dto';

@Controller('kiosks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KiosksController {
  constructor(private readonly kiosksService: KiosksService) {}

  @Post()
  @RequirePermissions('system_config')
  create(@Body() dto: CreateKioskDto) {
    return this.kiosksService.create(dto);
  }

  @Get()
  @RequirePermissions('manage_workers_site')
  findAll(
    @Query('siteId') siteId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.kiosksService.findAll({ siteId, status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('manage_workers_site')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.kiosksService.findOne(id);
  }

  // Kiosk JWT may only fetch its own roster; worker JWT needs manage_workers_site.
  @Get(':id/roster')
  getRoster(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (user.type === 'kiosk' && user.sub !== id) throw new ForbiddenException();
    if (user.type === 'worker' && !user.permissions.includes('manage_workers_site')) {
      throw new ForbiddenException();
    }
    return this.kiosksService.getRoster(id);
  }

  @Patch(':id')
  @RequirePermissions('system_config')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKioskDto) {
    return this.kiosksService.update(id, dto);
  }
}
