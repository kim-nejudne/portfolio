import {
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';

export const PREFLIGHT_QUEUE = 'preflight';

export interface PreflightJobData {
  jobReference: string;
  filePath: string;
  fileName: string;
  /** Who uploaded it, for the job event the worker writes. */
  actorName: string;
}

/**
 * The job queue, backed by Postgres.
 *
 * Redis and BullMQ would be the reflex choice, but Postgres already has to be
 * running and the droplet shares 1.9GB with TALLOW and three co-tenants — a
 * second datastore is a container, a memory budget and a backup story for a
 * workload of a few jobs an hour. pg-boss puts the queue in the database we
 * already run, and the worker runs in this process rather than a fourth
 * container.
 *
 * That choice has a real cost worth naming: a CPU-bound ghostscript run now
 * shares a process with the request handler. Concurrency is therefore pinned to
 * one and every external tool has a timeout, so a pathological PDF stalls one
 * job rather than the API.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private boss: PgBoss | null = null;
  private readonly timeoutMs: number;
  private readonly concurrency: number;

  constructor(private readonly config: ConfigService) {
    this.timeoutMs = config.get<number>('PREFLIGHT_TIMEOUT_MS', 120_000);
    this.concurrency = config.get<number>('PREFLIGHT_CONCURRENCY', 1);
  }

  async onModuleInit(): Promise<void> {
    const boss = new PgBoss({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
      // Its own small pool. Sharing the API's would let a queue poll block a
      // request for a connection, which is the wrong way round.
      max: 2,
      schema: 'pgboss',
    });

    boss.on('error', (error) => this.logger.error('pg-boss error', error));

    await boss.start();
    await boss.createQueue(PREFLIGHT_QUEUE, {
      // One preflight at a time across the whole deployment, not just per
      // worker — `exclusive` is what makes the concurrency cap real if this
      // ever runs as more than one process.
      policy: this.concurrency === 1 ? 'exclusive' : 'standard',
      // A crashed worker should retry twice, then stop. Preflight is
      // deterministic: a third attempt on the same bytes fails the same way.
      retryLimit: 2,
      retryDelay: 30,
      expireInSeconds: Math.ceil(this.timeoutMs / 1000) + 30,
      retentionSeconds: 7 * 24 * 60 * 60,
    });

    this.boss = boss;
    this.logger.log(`queue ready (concurrency ${this.concurrency})`);
  }

  async onApplicationShutdown(): Promise<void> {
    // `graceful` lets an in-flight preflight finish rather than leaving a job
    // half-written and a report with no checks.
    await this.boss?.stop({ graceful: true, timeout: 30_000 });
    this.boss = null;
  }

  private require(): PgBoss {
    if (!this.boss) throw new Error('Queue used before start, or after shutdown.');
    return this.boss;
  }

  async enqueuePreflight(data: PreflightJobData): Promise<string | null> {
    return this.require().send(PREFLIGHT_QUEUE, data, {
      // Re-uploading the same artwork to the same job while one run is already
      // pending should not queue a second identical analysis.
      singletonKey: data.jobReference,
    });
  }

  /** Registers the worker. Called once, by PreflightWorker. */
  async workPreflight(handler: (data: PreflightJobData) => Promise<void>): Promise<void> {
    await this.require().work<PreflightJobData>(
      PREFLIGHT_QUEUE,
      { batchSize: 1, pollingIntervalSeconds: 2 },
      // pg-boss 11 hands the handler a batch even when batchSize is 1.
      async (jobs) => {
        for (const job of jobs) {
          await handler(job.data);
        }
      },
    );
  }
}
