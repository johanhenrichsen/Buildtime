import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { WorkersModule } from './workers/workers.module';
import { SitesModule } from './sites/sites.module';
import { KiosksModule } from './kiosks/kiosks.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { AttendanceModule } from './attendance/attendance.module';
import { CutoffsModule } from './cutoffs/cutoffs.module';
import { RulesModule } from './rules/rules.module';
import { DtrModule } from './dtr/dtr.module';
import { AuditModule } from './audit/audit.module';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    WorkersModule,
    SitesModule,
    KiosksModule,
    EnrollmentModule,
    AttendanceModule,
    CutoffsModule,
    RulesModule,
    DtrModule,
    AuditModule,
  ],
})
export class AppModule {}
