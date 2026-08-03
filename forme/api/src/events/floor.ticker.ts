import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PressesService } from '../modules';
import { EventsGateway } from './events.gateway';

/**
 * Pushes the floor board.
 *
 * Polls the database and fans out over the socket rather than having each
 * screen poll the API. The board is a wall display that may be open for weeks,
 * so the important part is the idle check: with nobody watching, this does no
 * database work at all.
 */
@Injectable()
export class FloorTicker {
  private readonly logger = new Logger(FloorTicker.name);

  constructor(
    private readonly presses: PressesService,
    private readonly events: EventsGateway,
  ) {}

  @Interval(5_000)
  async tick(): Promise<void> {
    try {
      if (!(await this.events.hasFloorWatchers())) return;
      this.events.emitFloorTick(await this.presses.list());
    } catch (error) {
      this.logger.warn(
        `floor tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
