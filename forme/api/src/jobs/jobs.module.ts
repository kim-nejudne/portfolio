import { Module } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { JobsController } from './jobs.controller';
import { JobsRepository } from './jobs.repository';
import { JobsService } from './jobs.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, PricingService],
  exports: [JobsService, JobsRepository],
})
export class JobsModule {}
