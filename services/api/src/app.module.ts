import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { WorkersModule } from './workers/workers.module';
import { SitesModule } from './sites/sites.module';
import { KiosksModule } from './kiosks/kiosks.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkersModule,
    SitesModule,
    KiosksModule,
  ],
})
export class AppModule {}
