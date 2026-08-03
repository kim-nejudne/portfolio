import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './db/database.module';
import { SyncModule } from './sync/sync.module';
import { HealthController } from './health.controller';
import { DeviceGuard } from './common/device.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Under test, use only what the runner sets. A .env that beats an explicit
      // environment variable is how FORME's e2e suite ended up seeding one
      // database and asserting against another.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    TerminusModule,
    DatabaseModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: reject an unregistered device before spending a database
    // round trip on rate limiting it.
    { provide: APP_GUARD, useClass: DeviceGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
