import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload, Permission } from '@buildtime/shared-types';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user: JwtPayload = context.switchToHttp().getRequest().user;
    if (!user?.permissions) throw new ForbiddenException();

    const hasAll = required.every((p) => (user.permissions as string[]).includes(p));
    if (!hasAll) throw new ForbiddenException();

    return true;
  }
}
