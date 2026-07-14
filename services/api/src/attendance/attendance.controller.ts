import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { KioskJwtPayload, WorkerJwtPayload } from '@buildtime/shared-types';
import { AttendanceService } from './attendance.service';
import { SyncEventsDto } from './dto/sync-events.dto';
import { ReviewEventDto } from './dto/review-event.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Kiosk-only endpoint — syncs queued events from device to server.
  // Server timestamp is set here (authoritative); client_ts stored for audit only.
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('checkin_kiosk')
  sync(@Body() dto: SyncEventsDto, @CurrentUser() user: KioskJwtPayload) {
    return this.attendanceService.syncEvents(dto, user);
  }

  // Admin-only manual clock-in/out. No kiosk involved; requires edit_attendance.
  @Post('manual')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('edit_attendance')
  manualRecord(
    @Body() dto: ManualAttendanceDto,
    @CurrentUser() user: WorkerJwtPayload,
  ) {
    return this.attendanceService.manualRecord(dto, user.sub);
  }

  // Lists events where flaggedForReview = true, joined with worker name.
  @Get('flagged')
  @RequirePermissions('edit_attendance')
  getFlagged(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.attendanceService.getFlagged({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // Review a flagged event — approve or reject. Writes immutable audit_log entry.
  @Patch(':id/review')
  @RequirePermissions('edit_attendance')
  reviewEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewEventDto,
    @CurrentUser() user: WorkerJwtPayload,
  ) {
    return this.attendanceService.reviewEvent(id, dto, user);
  }
}
