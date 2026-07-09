import {
  Body,
  Controller,
  Delete,
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
import { WorkersService } from './workers.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

@Controller('workers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Post()
  @RequirePermissions('manage_workers_all')
  create(@Body() dto: CreateWorkerDto) {
    return this.workersService.create(dto);
  }

  @Get()
  @RequirePermissions('manage_workers_site')
  findAll(
    @Query('status') status?: string,
    @Query('roleId') roleId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workersService.findAll({ status, roleId, page, limit });
  }

  @Get(':id')
  @RequirePermissions('manage_workers_site')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('manage_workers_site')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkerDto) {
    return this.workersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('manage_workers_all')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workersService.remove(id);
  }
}
