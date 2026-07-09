import { Module } from '@nestjs/common';
import { DtrService } from './dtr.service';
import { DtrController } from './dtr.controller';

@Module({
  providers: [DtrService],
  controllers: [DtrController],
})
export class DtrModule {}
