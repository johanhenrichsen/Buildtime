import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { WorkerJwtPayload } from '@buildtime/shared-types';
import { UpdateDtrDto } from './dto/update-dtr.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DtrService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCutoff(cutoffId: string, params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip  = (page - 1) * limit;

    const where = { cutoffId };

    const [data, total] = await Promise.all([
      this.prisma.dtrRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'asc' }, { worker: { name: 'asc' } }],
        select: {
          id: true,
          date: true,
          regularHrs: true,
          otHrs: true,
          nightDiffHrs: true,
          lateMin: true,
          undertimeMin: true,
          status: true,
          worker: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
      this.prisma.dtrRecord.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async update(id: string, dto: UpdateDtrDto, actor: WorkerJwtPayload) {
    const record = await this.prisma.dtrRecord.findUnique({
      where: { id },
      select: {
        id: true,
        regularHrs: true,
        otHrs: true,
        nightDiffHrs: true,
        lateMin: true,
        undertimeMin: true,
        status: true,
      },
    });

    if (!record) throw new NotFoundException(`DTR record ${id} not found`);

    const before: Prisma.InputJsonValue = {
      regularHrs:   record.regularHrs.toString(),
      otHrs:        record.otHrs.toString(),
      nightDiffHrs: record.nightDiffHrs.toString(),
      lateMin:      record.lateMin,
      undertimeMin: record.undertimeMin,
      status:       record.status,
    };

    const updateData: Prisma.DtrRecordUpdateInput = { status: 'approved' };
    if (dto.regularHrs   !== undefined) updateData.regularHrs   = new Prisma.Decimal(dto.regularHrs.toFixed(2));
    if (dto.otHrs        !== undefined) updateData.otHrs        = new Prisma.Decimal(dto.otHrs.toFixed(2));
    if (dto.nightDiffHrs !== undefined) updateData.nightDiffHrs = new Prisma.Decimal(dto.nightDiffHrs.toFixed(2));
    if (dto.lateMin      !== undefined) updateData.lateMin      = dto.lateMin;
    if (dto.undertimeMin !== undefined) updateData.undertimeMin = dto.undertimeMin;

    const updated = await this.prisma.dtrRecord.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        regularHrs: true,
        otHrs: true,
        nightDiffHrs: true,
        lateMin: true,
        undertimeMin: true,
        status: true,
      },
    });

    const after: Prisma.InputJsonValue = {
      regularHrs:   updated.regularHrs.toString(),
      otHrs:        updated.otHrs.toString(),
      nightDiffHrs: updated.nightDiffHrs.toString(),
      lateMin:      updated.lateMin,
      undertimeMin: updated.undertimeMin,
      status:       updated.status,
      reason:       dto.reason,
    };

    await this.prisma.auditLog.create({
      data: {
        actorId:  actor.sub,
        action:   'manual_edit_dtr',
        entity:   'dtr_record',
        entityId: id,
        before,
        after,
      },
    });

    return updated;
  }

  async exportByCutoff(cutoffId: string) {
    const records = await this.prisma.dtrRecord.findMany({
      where: { cutoffId },
      orderBy: [{ date: 'asc' }, { worker: { name: 'asc' } }],
      select: {
        date: true,
        regularHrs: true,
        otHrs: true,
        nightDiffHrs: true,
        lateMin: true,
        undertimeMin: true,
        status: true,
        worker: { select: { employeeNo: true, name: true } },
      },
    });

    return records.map(r => ({
      employeeNo:   r.worker.employeeNo,
      name:         r.worker.name,
      date:         r.date.toISOString().slice(0, 10),
      regularHrs:   Number(r.regularHrs),
      otHrs:        Number(r.otHrs),
      nightDiffHrs: Number(r.nightDiffHrs),
      lateMin:      r.lateMin,
      undertimeMin: r.undertimeMin,
      status:       r.status,
    }));
  }
}
