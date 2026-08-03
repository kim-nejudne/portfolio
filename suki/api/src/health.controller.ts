import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from './db/database.module';
import { Public } from './common/device.guard';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /**
   * Checks the database round trip, not just that the process is up. A Node
   * process answering 200 while Postgres is unreachable is not healthy, it is
   * misleading — and for a sync endpoint it would tell a phone its queue drained
   * when nothing was stored.
   */
  // The container healthcheck has no device key.
  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        try {
          await this.db.execute(sql`select 1`);
          return { database: { status: 'up' as const } };
        } catch (error) {
          return {
            database: {
              status: 'down' as const,
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      },
    ]);
  }
}
