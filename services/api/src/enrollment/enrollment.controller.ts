import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkerJwtPayload } from '@buildtime/shared-types';
import { EnrollmentService } from './enrollment.service';
import { EnrollWorkerDto } from './dto/enroll-worker.dto';
import { MatchFaceDto } from './dto/match-face.dto';

@Controller('enrollment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentService) {}

  // Matches a face embedding against enrolled workers — used by the admin advance request flow.
  @Post('match')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('manage_workers_site')
  matchFace(@Body() dto: MatchFaceDto) {
    return this.enrollmentService.matchFace(dto.embeddingVector);
  }

  // HR officer or site manager submits a captured embedding for a worker.
  @Post(':workerId')
  @RequirePermissions('manage_workers_site')
  enroll(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @Body() dto: EnrollWorkerDto,
    @CurrentUser() user: WorkerJwtPayload,
  ) {
    return this.enrollmentService.enroll(workerId, dto, user.sub);
  }

  // Returns enrollment status + embedding metadata (never the vector itself).
  @Get(':workerId')
  @RequirePermissions('manage_workers_site')
  getStatus(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.enrollmentService.getStatus(workerId);
  }

  @Get('suggestions')
  @RequirePermissions('manage_workers_site')
  getSuggestions() {
    return this.enrollmentService.getSuggestions();
  }

  // Full embedding history (active + revoked) for HR dispute review.
  @Get(':workerId/history')
  @RequirePermissions('manage_workers_all')
  getHistory(@Param('workerId', ParseUUIDPipe) workerId: string) {
    return this.enrollmentService.getHistory(workerId);
  }

  // Revoke active enrollment — requires higher permission than enroll.
  @Delete(':workerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('manage_workers_all')
  revoke(
    @Param('workerId', ParseUUIDPipe) workerId: string,
    @CurrentUser() user: WorkerJwtPayload,
  ) {
    return this.enrollmentService.revoke(workerId, user.sub);
  }
}
