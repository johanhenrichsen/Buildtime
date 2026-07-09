import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtPayload, KioskJwtPayload, Permission, WorkerJwtPayload } from '@buildtime/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateWorker(email: string, password: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { email },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });

    if (!worker?.passwordHash) return null;

    const match = await bcrypt.compare(password, worker.passwordHash);
    if (!match) return null;

    return worker;
  }

  login(worker: Awaited<ReturnType<AuthService['validateWorker']>>) {
    if (!worker) throw new UnauthorizedException();

    const permissions = worker.role.rolePermissions.map(
      (rp) => rp.permission.name as Permission,
    );

    const payload: WorkerJwtPayload = {
      sub: worker.id,
      type: 'worker',
      name: worker.name,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      worker: { id: worker.id, name: worker.name, role: worker.role.name },
    };
  }

  async kioskLogin(deviceKey: string) {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { deviceKey },
    });

    if (!kiosk || kiosk.status !== 'active') {
      throw new UnauthorizedException('Unknown or inactive kiosk');
    }

    const payload: KioskJwtPayload = {
      sub: kiosk.id,
      type: 'kiosk',
      siteId: kiosk.siteId,
      permissions: ['checkin_kiosk'],
    };

    return { access_token: this.jwtService.sign(payload) };
  }

  async changePassword(workerId: string, newPassword: string) {
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.worker.update({
      where: { id: workerId },
      data: { passwordHash: hash },
    });
  }
}
