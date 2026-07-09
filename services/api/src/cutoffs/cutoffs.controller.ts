import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CutoffsService } from './cutoffs.service';
import { CreateCutoffDto } from './dto/create-cutoff.dto';

@Controller('cutoffs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CutoffsController {
  constructor(private readonly cutoffsService: CutoffsService) {}

  @Post()
  @RequirePermissions('run_payroll')
  create(@Body() dto: CreateCutoffDto) {
    return this.cutoffsService.create(dto);
  }

  @Get()
  @RequirePermissions('run_payroll')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cutoffsService.findAll({
      page:  page  ? parseInt(page,  10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('run_payroll')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cutoffsService.findOne(id);
  }
}
