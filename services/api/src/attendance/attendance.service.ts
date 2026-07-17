import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KioskJwtPayload, WorkerJwtPayload } from '@buildtime/shared-types';
import { SyncEventsDto } from './dto/sync-events.dto';
import { ReviewEventDto } from './dto/review-event.dto';
import { ManualAttendanceDto } from './dto/manual-attendance.dto';
import { AttendanceEventsQueryDto } from './dto/attendance-events-query.dto';
import { RequestAdvanceDto } from './dto/request-advance.dto';
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

  async getOnSite() {
    // Last event per worker in the last 24 hours; if it's 'in', they're on site.
    const rows = await this.prisma.$queryRaw<{
      workerId: string;
      name: string;
      employeeNo: string;
      photo: string | null;
      siteId: string;
      siteName: string;
      clockedInAt: Date;
    }[]>`
      WITH last_events AS (
        SELECT DISTINCT ON (ae.worker_id)
          ae.worker_id,
          ae.event_type,
          ae.server_ts,
          ae.site_id
        FROM attendance_events ae
        WHERE ae.server_ts >= NOW() - INTERVAL '24 hours'
        ORDER BY ae.worker_id, ae.server_ts DESC
      )
      SELECT
        le.worker_id   AS "workerId",
        le.server_ts   AS "clockedInAt",
        le.site_id     AS "siteId",
        w.name,
        w.employee_no  AS "employeeNo",
        w.photo,
        s.name         AS "siteName"
      FROM last_events le
      JOIN workers w ON w.id = le.worker_id
      JOIN sites s ON s.id = le.site_id
      WHERE le.event_type = 'in'
      ORDER BY w.name
    `;
    return rows;
  }

  async getDashboardStats() {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    // Use midnight PHT-8 = yesterday 16:00 UTC as the "today PHT" boundary
    const todayPht = new Date(todayUtc.getTime() - 8 * 60 * 60 * 1000);

    const [todayClockIns, pendingFlagged, pendingAdvances, onSite] = await Promise.all([
      this.prisma.attendanceEvent.count({
        where: { serverTs: { gte: todayPht }, eventType: 'in' },
      }),
      this.prisma.attendanceEvent.count({ where: { flaggedForReview: true } }),
      this.prisma.cashAdvance.count({ where: { status: 'pending' } }),
      this.getOnSite(),
    ]);

    return {
      onSiteCount: onSite.length,
      todayClockIns,
      pendingFlagged,
      pendingAdvances,
    };
  }

  async getNotifications() {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [flagged, advances, lowConfidence] = await Promise.all([
      this.prisma.attendanceEvent.findMany({
        where: { flaggedForReview: true, serverTs: { gte: since7d } },
        orderBy: { serverTs: 'desc' },
        take: 20,
        select: { id: true, serverTs: true, worker: { select: { name: true } } },
      }),
      this.prisma.cashAdvance.findMany({
        where: { status: 'pending', requestedAt: { gte: since7d } },
        orderBy: { requestedAt: 'desc' },
        take: 20,
        select: { id: true, amount: true, requestedAt: true, worker: { select: { name: true } } },
      }),
      // Workers with >3 low-confidence events in last 30 days
      this.prisma.$queryRaw<{ workerId: string; name: string; employeeNo: string; count: bigint; lastEventAt: Date }[]>`
        SELECT ae.worker_id AS "workerId", w.name, w.employee_no AS "employeeNo",
               COUNT(*) AS count, MAX(ae.server_ts) AS "lastEventAt"
        FROM attendance_events ae
        JOIN workers w ON w.id = ae.worker_id
        WHERE ae.match_method = 'face_low_confidence'
          AND ae.server_ts >= ${since30d}
        GROUP BY ae.worker_id, w.name, w.employee_no
        HAVING COUNT(*) > 3
        ORDER BY count DESC
        LIMIT 20
      `,
    ]);

    const items = [
      ...flagged.map(f => ({
        id: f.id,
        type: 'flagged' as const,
        workerName: f.worker.name,
        message: 'Flagged attendance event',
        ts: f.serverTs.toISOString(),
        link: `/flagged/${f.id}`,
      })),
      ...advances.map(a => ({
        id: a.id,
        type: 'advance' as const,
        workerName: a.worker.name,
        message: `PHP ${Number(a.amount).toLocaleString()} advance requested`,
        ts: a.requestedAt.toISOString(),
        link: `/advances`,
      })),
      ...lowConfidence.map(r => ({
        id: r.workerId,
        type: 'reenroll' as const,
        workerName: r.name,
        message: `${Number(r.count)} low-confidence events — needs re-enrollment`,
        ts: r.lastEventAt.toISOString(),
        link: `/enrollment`,
      })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

    return { items };
  }

  async getWorkerStatus(workerId: string) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true, employeeNo: true },
    });
    if (!worker) throw new NotFoundException(`Worker ${workerId} not found`);

    const [todayEvents, pendingAdvances] = await Promise.all([
      this.prisma.attendanceEvent.findMany({
        where: { workerId, serverTs: { gte: since } },
        orderBy: { serverTs: 'asc' },
        select: { eventType: true, serverTs: true },
      }),
      this.prisma.cashAdvance.findMany({
        where: { workerId, status: 'pending' },
        orderBy: { requestedAt: 'desc' },
        select: { id: true, amount: true, reason: true, status: true, requestedAt: true },
      }),
    ]);

    const lastEvent = todayEvents[todayEvents.length - 1] ?? null;
    return {
      workerId: worker.id,
      name: worker.name,
      employeeNo: worker.employeeNo,
      todayStatus: lastEvent?.eventType ?? null,
      lastEventAt: lastEvent?.serverTs.toISOString() ?? null,
      todayEvents: todayEvents.map(e => ({ type: e.eventType, time: e.serverTs.toISOString() })),
      pendingAdvances: pendingAdvances.map(a => ({
        id: a.id,
        amount: a.amount.toString(),
        reason: a.reason,
        status: a.status,
        requestedAt: a.requestedAt.toISOString(),
      })),
    };
  }

  async requestAdvance(dto: RequestAdvanceDto) {
    const worker = await this.prisma.worker.findUnique({ where: { id: dto.workerId }, select: { id: true, status: true } });
    if (!worker) throw new NotFoundException(`Worker not found`);
    if (worker.status !== 'active') throw new BadRequestException('Worker is not active');

    return this.prisma.cashAdvance.create({
      data: {
        workerId: dto.workerId,
        amount: dto.amount,
        reason: dto.reason,
        status: 'pending',
      },
      select: { id: true, amount: true, reason: true, status: true },
    });
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
