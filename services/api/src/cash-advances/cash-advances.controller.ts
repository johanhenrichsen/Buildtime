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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '@buildtime/shared-types';
import { CashAdvancesService } from './cash-advances.service';
import { CreateCashAdvanceDto } from './dto/create-cash-advance.dto';
import { ReviewCashAdvanceDto } from './dto/review-cash-advance.dto';

@Controller('cash-advances')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashAdvancesController {
  constructor(private readonly service: CashAdvancesService) {}

  @Post()
  @RequirePermissions('manage_workers_site')
  create(@Body() dto: CreateCashAdvanceDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('manage_workers_site')
  findAll(
    @Query('workerId') workerId?: string,
    @Query('status')   status?: string,
    @Query('page')     page?: number,
    @Query('limit')    limit?: number,
  ) {
    return this.service.findAll({ workerId, status, page, limit });
  }

  @Get(':id')
  @RequirePermissions('manage_workers_site')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/review')
  @RequirePermissions('manage_workers_site')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCashAdvanceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.review(id, user.sub, dto);
  }

  @Patch(':id/deduct')
  @RequirePermissions('manage_workers_site')
  markDeducted(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('cutoffId', ParseUUIDPipe) cutoffId: string,
  ) {
    return this.service.markDeducted(id, cutoffId);
  }
}
