import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { KioskAuthDto } from './dto/kiosk-auth.dto';
import { WorkerJwtPayload } from '@buildtime/shared-types';
import { IsString, MinLength } from 'class-validator';

class ChangePasswordDto {
  @IsString() @MinLength(8) newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@CurrentUser() user: any) {
    return this.authService.login(user);
  }

  @Post('kiosk-token')
  @HttpCode(HttpStatus.OK)
  kioskLogin(@Body() dto: KioskAuthDto) {
    return this.authService.kioskLogin(dto.deviceKey);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: WorkerJwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.sub, dto.newPassword);
  }
}
