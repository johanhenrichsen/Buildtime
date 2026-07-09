import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCutoffDto } from './dto/create-cutoff.dto';

@Injectable()
export class CutoffsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCutoffDto) {
    return this.prisma.payrollCutoff.create({
      data: {
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
      },
    });
  }

  async findAll(params: { page?: number; limit?: number }) {
    const page  = params.page  ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip  = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.payrollCutoff.findMany({
        skip,
        take: limit,
        orderBy: { periodStart: 'desc' },
      }),
      this.prisma.payrollCutoff.count(),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string) {
    const cutoff = await this.prisma.payrollCutoff.findUnique({ where: { id } });
    if (!cutoff) throw new NotFoundException(`Cutoff ${id} not found`);
    return cutoff;
  }
}
