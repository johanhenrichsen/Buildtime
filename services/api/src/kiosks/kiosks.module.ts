import { Module } from '@nestjs/common';
import { KiosksService } from './kiosks.service';
import { KiosksController } from './kiosks.controller';

@Module({
  providers: [KiosksService],
  controllers: [KiosksController],
  exports: [KiosksService],
})
export class KiosksModule {}
