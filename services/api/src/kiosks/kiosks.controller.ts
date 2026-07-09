import {
  Body,
  Controller,
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

  @Patch(':id')
  @RequirePermissions('system_config')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateKioskDto) {
    return this.kiosksService.update(id, dto);
  }
}
