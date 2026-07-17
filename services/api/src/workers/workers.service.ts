import { ConflictException, Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';

const SAFE_SELECT = {
  id: true,
  employeeNo: true,
  name: true,
  roleId: true,
  employmentType: true,
  dailyRate: true,
  hireDate: true,
  status: true,
  email: true,
  photo: true,
  faceEmbeddingRef: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  // Never return passwordHash or *Enc fields
} as const;

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkerDto) {
    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    try {
      return await this.prisma.worker.create({
        data: {
          employeeNo: dto.employeeNo,
          name: dto.name,
          roleId: dto.roleId,
          employmentType: dto.employmentType,
          dailyRate: dto.dailyRate,
          hireDate: new Date(dto.hireDate),
          email: dto.email,
          passwordHash,
        },
        select: SAFE_SELECT,
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const field = (e.meta?.target as string[])?.join(', ') ?? 'field';
        throw new ConflictException(`A worker with this ${field} already exists.`);
      }
      throw e;
    }
  }

  findAll(params: { status?: string; roleId?: string; page?: number; limit?: number }) {
    const page = Number(params.page) || 1;
    const limit = Math.min(Number(params.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(params.status && { status: params.status }),
      ...(params.roleId && { roleId: params.roleId }),
    };

    return Promise.all([
      this.prisma.worker.findMany({ where, skip, take: limit, select: SAFE_SELECT, orderBy: { name: 'asc' } }),
      this.prisma.worker.count({ where }),
    ]).then(([data, total]) => ({ data, meta: { total, page, limit } }));
  }

  async findOne(id: string) {
    const worker = await this.prisma.worker.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!worker) throw new NotFoundException(`Worker ${id} not found`);
    return worker;
  }

  async update(id: string, dto: UpdateWorkerDto) {
    await this.findOne(id);
    return this.prisma.worker.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.roleId && { roleId: dto.roleId }),
        ...(dto.employmentType && { employmentType: dto.employmentType }),
        ...(dto.dailyRate !== undefined && { dailyRate: dto.dailyRate }),
        ...(dto.status && { status: dto.status }),
        ...('photo' in dto && { photo: dto.photo ?? null }),
      },
      select: SAFE_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Soft-delete — construction records must never be hard-deleted
    return this.prisma.worker.update({
      where: { id },
      data: { status: 'terminated' },
      select: SAFE_SELECT,
    });
  }
}
