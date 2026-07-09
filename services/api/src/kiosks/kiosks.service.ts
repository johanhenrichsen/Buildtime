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
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
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
