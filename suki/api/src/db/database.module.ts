import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE = Symbol('SUKI_DATABASE');
export const DATABASE_POOL = Symbol('SUKI_DATABASE_POOL');
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
          // Sized for the droplet, which shares 1.9GB with five other apps.
          max: 6,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        }),
    },
    { provide: DATABASE, inject: [DATABASE_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    // Without this the process holds sockets open on SIGTERM and every deploy
    // waits out the full docker stop timeout.
    await this.pool.end();
    this.logger.log('Postgres pool closed');
  }
}
