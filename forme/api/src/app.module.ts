import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './db/database.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards';
import { AllExceptionsFilter } from './common/exception.filter';
import { AuditInterceptor } from './common/audit.interceptor';
import { JobsModule } from './jobs/jobs.module';
import { QueueModule } from './queue/queue.module';
import { EventsModule } from './events/events.module';
import { FilesModule } from './files/files.module';
import { PreflightModule } from './preflight/preflight.module';
import { HealthController } from './health.controller';
import {
  CustomersModule,
  ImpositionModule,
  PressesModule,
  PricingModule,
  QuotesModule,
} from './modules';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      /**
       * Under test, ignore `.env` entirely and use only what the runner sets.
       *
       * The file is a developer convenience that otherwise wins over an
       * explicit environment variable — which meant the e2e suite pointed at
       * `forme_test`, seeded it, and then quietly ran every assertion against
       * the development database.
       */
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ScheduleModule.forRoot(),
    // A blanket ceiling. Sign-in has its own much tighter budget declared on
    // the route; this exists so one client cannot hammer everything else.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    TerminusModule,
    DatabaseModule,
    QueueModule,
    AuthModule,
    EventsModule,
    JobsModule,
    FilesModule,
    PreflightModule,
    QuotesModule,
    PricingModule,
    ImpositionModule,
    PressesModule,
    CustomersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate, then rate-limit, so an unauthenticated
    // flood is rejected before it costs a database round trip.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
