import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE = Symbol('FORME_DATABASE');
export const DATABASE_POOL = Symbol('FORME_DATABASE_POOL');

export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Pool({
          connectionString: config.getOrThrow<string>('DATABASE_URL'),
          /**
           * Sized for the droplet, not for the laptop. Postgres runs with
           * max_connections=20 next to TALLOW and three co-tenants; taking 8 of
           * them leaves room for migrations, pg-boss and a psql session without
           * the API being the reason someone cannot get a connection.
           */
          max: 8,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        }),
    },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    // Without this the process hangs on SIGTERM holding open sockets, and
    // `docker compose down` waits out its full timeout on every deploy.
    await this.pool.end();
    this.logger.log('Postgres pool closed');
  }
}
