import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { KioskJwtPayload } from '@buildtime/shared-types';
import { SyncEventsDto } from './dto/sync-events.dto';

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
}
