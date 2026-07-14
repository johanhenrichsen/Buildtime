import { Module } from '@nestjs/common';
import { CashAdvancesService } from './cash-advances.service';
import { CashAdvancesController } from './cash-advances.controller';

@Module({
  providers: [CashAdvancesService],
  controllers: [CashAdvancesController],
})
export class CashAdvancesModule {}
