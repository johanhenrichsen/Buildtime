import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCashAdvanceDto } from './dto/create-cash-advance.dto';
import { ReviewCashAdvanceDto } from './dto/review-cash-advance.dto';

const INCLUDE = {
  worker: { select: { id: true, name: true, employeeNo: true } },
  reviewer: { select: { id: true, name: true } },
} as const;

@Injectable()
export class CashAdvancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCashAdvanceDto) {
    const worker = await this.prisma.worker.findUnique({ where: { id: dto.workerId } });
    if (!worker) throw new NotFoundException('Worker not found');

    return this.prisma.cashAdvance.create({
      data: {
        workerId: dto.workerId,
        amount: dto.amount,
        reason: dto.reason,
      },
      include: INCLUDE,
    });
  }

  async findAll(params: { workerId?: string; status?: string; page?: number; limit?: number }) {
    const page  = Math.max(1, Number(params.page)  || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip  = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params.workerId) where.workerId = params.workerId;
    if (params.status)   where.status   = params.status;

    const [data, total] = await Promise.all([
      this.prisma.cashAdvance.findMany({
        where,
        include: INCLUDE,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.cashAdvance.count({ where }),
    ]);

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string) {
    const advance = await this.prisma.cashAdvance.findUnique({ where: { id }, include: INCLUDE });
    if (!advance) throw new NotFoundException('Cash advance not found');
    return advance;
  }

  async review(id: string, reviewerId: string, dto: ReviewCashAdvanceDto) {
    const advance = await this.prisma.cashAdvance.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Cash advance not found');
    if (advance.status !== 'pending') {
      throw new BadRequestException(`Advance is already ${advance.status}`);
    }

    return this.prisma.cashAdvance.update({
      where: { id },
      data: {
        status:     dto.decision,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNote: dto.note ?? null,
      },
      include: INCLUDE,
    });
  }

  async markDeducted(id: string, cutoffId: string) {
    const advance = await this.prisma.cashAdvance.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Cash advance not found');
    if (advance.status !== 'approved') {
      throw new BadRequestException('Only approved advances can be marked as deducted');
    }

    return this.prisma.cashAdvance.update({
      where: { id },
      data: { status: 'deducted', cutoffId },
      include: INCLUDE,
    });
  }
}
