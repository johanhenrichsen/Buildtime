import { Module } from '@nestjs/common';
import { CutoffsService } from './cutoffs.service';
import { CutoffsController } from './cutoffs.controller';

@Module({
  providers: [CutoffsService],
  controllers: [CutoffsController],
})
export class CutoffsModule {}
