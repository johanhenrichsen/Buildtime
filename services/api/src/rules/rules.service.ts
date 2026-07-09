import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

function toPhilippineDate(utcDate: Date): string {
  const pht = new Date(utcDate.getTime() + PHT_OFFSET_MS);
  return pht.toISOString().slice(0, 10); // YYYY-MM-DD
}

function toPhtHours(utcDate: Date): number {
  const pht = new Date(utcDate.getTime() + PHT_OFFSET_MS);
  return pht.getUTCHours() + pht.getUTCMinutes() / 60;
}

/**
 * Compute night differential hours overlapping [22:00–06:00] PHT.
 * Checks 3 consecutive windows around the work period.
 */
function nightDiffHours(start: Date, end: Date): number {
  let total = 0;
  // Convert to PHT timestamps for window calculations
  const startPht = new Date(start.getTime() + PHT_OFFSET_MS);
  const endPht   = new Date(end.getTime()   + PHT_OFFSET_MS);

  for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
    // Build window base in PHT (but stored as UTC-equivalent for math)
    const base = new Date(startPht);
    base.setUTCHours(0, 0, 0, 0);
    base.setUTCDate(base.getUTCDate() + dayOffset);

    const winStart = new Date(base);
    winStart.setUTCHours(22, 0, 0, 0);

    const winEnd = new Date(base);
    winEnd.setUTCDate(winEnd.getUTCDate() + 1);
    winEnd.setUTCHours(6, 0, 0, 0);

    const oStart = Math.max(startPht.getTime(), winStart.getTime());
    const oEnd   = Math.min(endPht.getTime(),   winEnd.getTime());
    if (oEnd > oStart) total += (oEnd - oStart) / 3_600_000;
  }
  return total;
}

@Injectable()
export class RulesService {
  private readonly shiftStartHour: number;
  private readonly shiftEndHour: number;
  private readonly graceMinutes: number;
  private readonly lunchBreakMin: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.shiftStartHour = parseFloat(this.config.get('SHIFT_START_HOUR') ?? '7');
    this.shiftEndHour   = parseFloat(this.config.get('SHIFT_END_HOUR')   ?? '16');
    this.graceMinutes   = parseFloat(this.config.get('SHIFT_GRACE_MIN')  ?? '15');
    this.lunchBreakMin  = parseFloat(this.config.get('LUNCH_BREAK_MIN')  ?? '60');
  }

  async computeDtr(cutoffId: string) {
    const cutoff = await this.prisma.payrollCutoff.findUnique({ where: { id: cutoffId } });
    if (!cutoff) throw new NotFoundException(`Cutoff ${cutoffId} not found`);

    // Fetch all attendance events in the cutoff period (by serverTs)
    const events = await this.prisma.attendanceEvent.findMany({
      where: {
        serverTs: {
          gte: cutoff.periodStart,
          lte: cutoff.periodEnd,
        },
      },
      orderBy: { serverTs: 'asc' },
      select: {
        workerId: true,
        eventType: true,
        serverTs: true,
      },
    });

    // Group by workerId + PHT local date
    const groups = new Map<string, { workerId: string; date: string; events: { eventType: string; serverTs: Date }[] }>();

    for (const ev of events) {
      const date = toPhilippineDate(ev.serverTs);
      const key  = `${ev.workerId}::${date}`;
      if (!groups.has(key)) {
        groups.set(key, { workerId: ev.workerId, date, events: [] });
      }
      groups.get(key)!.events.push({ eventType: ev.eventType, serverTs: ev.serverTs });
    }

    const upserts: Prisma.PrismaPromise<unknown>[] = [];

    for (const group of groups.values()) {
      const ins  = group.events.filter(e => e.eventType === 'in').map(e => e.serverTs);
      const outs = group.events.filter(e => e.eventType === 'out').map(e => e.serverTs);

      if (ins.length === 0 || outs.length === 0) continue;

      const arrival   = new Date(Math.min(...ins.map(d => d.getTime())));
      const departure = new Date(Math.max(...outs.map(d => d.getTime())));

      if (departure <= arrival) continue;

      const arrivalHours   = toPhtHours(arrival);
      const departureHours = toPhtHours(departure);

      // Late: minutes after shiftStart + grace
      const lateMin = Math.max(0, Math.round((arrivalHours - (this.shiftStartHour + this.graceMinutes / 60)) * 60));

      // Undertime: minutes before shiftEnd (only if left early)
      const undertimeMin = departureHours < this.shiftEndHour
        ? Math.max(0, Math.round((this.shiftEndHour - departureHours) * 60))
        : 0;

      // Total minutes worked
      let totalMinutesWorked = (departure.getTime() - arrival.getTime()) / 60_000;

      // Deduct 60-min lunch if worked more than 5 hours
      if (totalMinutesWorked > 5 * 60) {
        totalMinutesWorked -= this.lunchBreakMin;
      }

      const regularHrs = Math.min(8, totalMinutesWorked / 60);

      // OT: hours after shiftEnd
      const otHrs = departureHours > this.shiftEndHour
        ? Math.max(0, departureHours - this.shiftEndHour)
        : 0;

      // Night differential
      const ndHrs = nightDiffHours(arrival, departure);

      const dateObj = new Date(group.date + 'T00:00:00.000Z');

      upserts.push(
        this.prisma.dtrRecord.upsert({
          where: { workerId_date: { workerId: group.workerId, date: dateObj } },
          create: {
            workerId:     group.workerId,
            cutoffId,
            date:         dateObj,
            regularHrs:   new Prisma.Decimal(regularHrs.toFixed(2)),
            otHrs:        new Prisma.Decimal(otHrs.toFixed(2)),
            nightDiffHrs: new Prisma.Decimal(ndHrs.toFixed(2)),
            lateMin,
            undertimeMin,
            status: 'draft',
          },
          update: {
            cutoffId,
            regularHrs:   new Prisma.Decimal(regularHrs.toFixed(2)),
            otHrs:        new Prisma.Decimal(otHrs.toFixed(2)),
            nightDiffHrs: new Prisma.Decimal(ndHrs.toFixed(2)),
            lateMin,
            undertimeMin,
            status: 'draft',
          },
        }),
      );
    }

    await this.prisma.$transaction(upserts);

    return { processed: upserts.length, cutoffId };
  }
}
