import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.shift.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException(`Shift ${id} not found`);
    return shift;
  }

  create(dto: CreateShiftDto) {
    return this.prisma.shift.create({ data: dto });
  }

  async update(id: string, dto: UpdateShiftDto) {
    await this.findOne(id);
    return this.prisma.shift.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    // Clear shiftId from any sites using this shift first
    await this.prisma.site.updateMany({ where: { shiftId: id }, data: { shiftId: null } });
    return this.prisma.shift.delete({ where: { id } });
  }
}
