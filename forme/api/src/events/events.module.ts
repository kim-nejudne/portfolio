import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PressesModule } from '../modules';
import { EventsGateway } from './events.gateway';
import { FloorTicker } from './floor.ticker';

/**
 * Global so JobsService and PreflightService can emit without importing a
 * module that would import them back. EventsModule deliberately depends on
 * nothing that depends on it.
 */
@Global()
@Module({
  imports: [AuthModule, PressesModule],
  providers: [EventsGateway, FloorTicker],
  exports: [EventsGateway],
})
export class EventsModule {}
