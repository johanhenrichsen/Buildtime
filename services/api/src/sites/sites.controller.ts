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
import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Controller('sites')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @RequirePermissions('system_config')
  create(@Body() dto: CreateSiteDto) {
    return this.sitesService.create(dto);
  }

  @Get()
  findAll(@Query('status') status?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.sitesService.findAll({ status, page, limit });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sitesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('system_config')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSiteDto) {
    return this.sitesService.update(id, dto);
  }
}
