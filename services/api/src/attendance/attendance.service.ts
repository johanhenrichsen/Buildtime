import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KioskJwtPayload, WorkerJwtPayload } from '@buildtime/shared-types';
import { SyncEventsDto } from './dto/sync-events.dto';
import { ReviewEventDto } from './dto/review-event.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';
import { AttendanceEventsQueryDto } from './dto/attendance-events-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async syncEvents(dto: SyncEventsDto, kiosk: KioskJwtPayload) {
    const results: { clientEventId: string; serverId: string; status: 'created' | 'duplicate' }[] = [];

    for (const event of dto.events) {
      const existing = await this.prisma.attendanceEvent.findFirst({
        where: { kioskId: kiosk.sub, clientEventId: event.clientEventId },
        select: { id: true },
      });

      if (existing) {
        results.push({ clientEventId: event.clientEventId, serverId: existing.id, status: 'duplicate' });
        continue;
      }

      // serverTs defaults to now() at DB level — authoritative for payroll
      const created = await this.prisma.attendanceEvent.create({
        data: {
          workerId: event.workerId,
          siteId: kiosk.siteId,
          kioskId: kiosk.sub,
          eventType: event.eventType,
          clientTs: new Date(event.clientTs),
          confidenceScore: event.confidenceScore,
          matchMethod: event.matchMethod,
          flaggedForReview: event.flaggedForReview,
          clientEventId: event.clientEventId,
        },
        select: { id: true },
      });

      results.push({ clientEventId: event.clientEventId, serverId: created.id, status: 'created' });
    }

    return { results };
  }

  async manualRecord(dto: ManualAttendanceDto, actorId: string) {
    const now = new Date();
    const event = await this.prisma.attendanceEvent.create({
      data: {
        workerId:        dto.workerId,
        siteId:          dto.siteId,
        kioskId:         null,
        eventType:       dto.eventType,
        clientTs:        now,
        confidenceScore: 1,
        matchMethod:     'manual_exception',
        flaggedForReview: false,
        clientEventId:   null,
      },
      select: { id: true, eventType: true, serverTs: true },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action:   `manual_attendance:${dto.eventType}`,
        entity:   'attendance_event',
        entityId: event.id,
        before:   {},
        after:    { workerId: dto.workerId, siteId: dto.siteId, eventType: dto.eventType } as Prisma.InputJsonValue,
      },
    });

    return event;
  }

  async getEvents(query: AttendanceEventsQueryDto) {
    const from = new Date(query.from);
    // Include the full 'to' day by moving the boundary to start of next day
    const to = new Date(query.to);
    to.setDate(to.getDate() + 1);

    return this.prisma.attendanceEvent.findMany({
      where: {
        serverTs: { gte: from, lt: to },
        ...(query.workerId ? { workerId: query.workerId } : {}),
      },
      orderBy: [{ worker: { name: 'asc' } }, { serverTs: 'asc' }],
      take: 5000,
      select: {
        id: true,
        eventType: true,
        serverTs: true,
        matchMethod: true,
        flaggedForReview: true,
        worker: { select: { name: true, employeeNo: true } },
        site: { select: { name: true } },
      },
    });
  }

  async getFlagged(params: { page?: number; limit?: number }) {
    const page  = Number(params.page)  || 1;
    const limit = Math.min(Number(params.limit) || 20, 100);
    const skip  = (page - 1) * limit;

    const where = { flaggedForReview: true };

    const [data, total] = await Promise.all([
      this.prisma.attendanceEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { serverTs: 'desc' },
        select: {
          id: true,
          eventType: true,
          serverTs: true,
          clientTs: true,
          confidenceScore: true,
          matchMethod: true,
          flaggedForReview: true,
          worker: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
      this.prisma.attendanceEvent.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async reviewEvent(id: string, dto: ReviewEventDto, actor: WorkerJwtPayload) {
    const event = await this.prisma.attendanceEvent.findUnique({
      where: { id },
      select: {
        id: true,
        flaggedForReview: true,
        workerId: true,
        eventType: true,
        serverTs: true,
        confidenceScore: true,
        matchMethod: true,
      },
    });

    if (!event) throw new NotFoundException(`Attendance event ${id} not found`);

    // Write immutable audit_log entry — do NOT mutate the attendance_event itself
    const before: Prisma.InputJsonValue = {
      flaggedForReview: event.flaggedForReview,
    };
    const after: Prisma.InputJsonValue = {
      decision: dto.decision,
      reason: dto.reason,
      reviewedBy: actor.sub,
    };

    await this.prisma.auditLog.create({
      data: {
        actorId:  actor.sub,
        action:   `review_flagged_event:${dto.decision}`,
        entity:   'attendance_event',
        entityId: id,
        before,
        after,
      },
    });

    return { id, decision: dto.decision, reason: dto.reason };
  }
}
