import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params: {
    entity?:   string;
    entityId?: string;
    actorId?:  string;
    page?:     number;
    limit?:    number;
  }) {
    const page  = params.page  ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip  = (page - 1) * limit;

    const where = {
      ...(params.entity   && { entity:   params.entity }),
      ...(params.entityId && { entityId: params.entityId }),
      ...(params.actorId  && { actorId:  params.actorId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { ts: 'desc' },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          before: true,
          after: true,
          ts: true,
          actor: { select: { id: true, name: true, employeeNo: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }
}
