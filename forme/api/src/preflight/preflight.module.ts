import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { PricingService } from '../pricing/pricing.service';
import { PreflightController } from './preflight.controller';
import { PreflightService } from './preflight.service';
import { PreflightWorker } from './preflight.worker';

@Module({
  imports: [JobsModule],
  controllers: [PreflightController],
  providers: [PreflightService, PreflightWorker, PricingService],
  exports: [PreflightService],
})
export class PreflightModule {}
