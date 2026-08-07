import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { sql } from 'drizzle-orm';
import { Public, SkipAudit } from './common/decorators';
import { DATABASE, type Database } from './db/database.module';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  /**
   * What the container healthcheck and nginx hit. Checks the database round
   * trip rather than just that the process is up — a Node process answering
   * 200 while Postgres is unreachable is not healthy, it is misleading.
   */
  @Public()
  @SkipAudit()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness and database reachability' })
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
