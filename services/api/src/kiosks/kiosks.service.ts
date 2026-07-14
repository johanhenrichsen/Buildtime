import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateKioskDto } from './dto/create-kiosk.dto';
import { UpdateKioskDto } from './dto/update-kiosk.dto';

@Injectable()
export class KiosksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateKioskDto) {
    const existing = await this.prisma.kiosk.findUnique({ where: { deviceKey: dto.deviceKey } });
    if (existing) throw new ConflictException('device_key already registered');

    return this.prisma.kiosk.create({
      data: { siteId: dto.siteId, deviceKey: dto.deviceKey },
      include: { site: { select: { id: true, name: true } } },
    });
  }

  findAll(params: { siteId?: string; status?: string; page?: number; limit?: number }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(Number(params.limit) || 20, 100);
    const where = {
      ...(params.siteId && { siteId: params.siteId }),
      ...(params.status && { status: params.status }),
    };

    return Promise.all([
      // Never expose deviceKey in list — only the issuing admin sees it at create time
      this.prisma.kiosk.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          siteId: true,
          status: true,
          lastSyncAt: true,
          createdAt: true,
          updatedAt: true,
          site: { select: { id: true, name: true } },
        },
      }),
      this.prisma.kiosk.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page, limit } }));
  }

  async findOne(id: string) {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        site: { select: { id: true, name: true } },
      },
    });
    if (!kiosk) throw new NotFoundException(`Kiosk ${id} not found`);
    return kiosk;
  }

  // Returns active workers with active embeddings for this kiosk's site.
  // Vectors are fetched via raw SQL (pgvector Unsupported in Prisma).
  // For MVP (1 site) all active enrolled workers are returned.
  async getRoster(kioskId: string) {
    const kiosk = await this.findOne(kioskId);

    const rows = await this.prisma.$queryRaw<{
      workerId: string;
      name: string;
      employeeNo: string;
      embeddingVector: string;
    }[]>`
      SELECT w.id             AS "workerId",
             w.name,
             w.employee_no    AS "employeeNo",
             fe.embedding_vector::text AS "embeddingVector"
      FROM   workers w
      JOIN   face_embeddings fe ON fe.id = w.face_embedding_ref
      WHERE  w.status = 'active'
        AND  fe.active = true
    `;

    // pgvector text format is '[n1,n2,...]' — valid JSON array
    return rows.map((r) => ({
      workerId: r.workerId,
      name: r.name,
      employeeNo: r.employeeNo,
      embedding: JSON.parse(r.embeddingVector) as number[],
    }));
  }

  async update(id: string, dto: UpdateKioskDto) {
    await this.findOne(id);
    return this.prisma.kiosk.update({
      where: { id },
      data: dto,
      select: {
        id: true, siteId: true, status: true, lastSyncAt: true, updatedAt: true,
      },
    });
  }
}
