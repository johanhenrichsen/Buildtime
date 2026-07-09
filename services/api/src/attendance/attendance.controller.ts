import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { KioskJwtPayload } from '@buildtime/shared-types';
import { AttendanceService } from './attendance.service';
import { SyncEventsDto } from './dto/sync-events.dto';

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
}
