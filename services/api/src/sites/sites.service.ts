import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSiteDto) {
    return this.prisma.site.create({ data: dto });
  }

  findAll(params: { status?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const where = params.status ? { status: params.status } : {};

    return Promise.all([
      this.prisma.site.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { kiosks: true } } },
      }),
      this.prisma.site.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page, limit } }));
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { kiosks: true, _count: { select: { attendanceEvents: true } } },
    });
    if (!site) throw new NotFoundException(`Site ${id} not found`);
    return site;
  }

  async update(id: string, dto: UpdateSiteDto) {
    await this.findOne(id);
    return this.prisma.site.update({ where: { id }, data: dto });
  }
}
