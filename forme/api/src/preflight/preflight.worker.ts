import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { hasBlockingFailure } from '@forme/domain';
import { SYSTEM_ACTOR } from '../jobs/jobs.service';
import { JobsService } from '../jobs/jobs.service';
import { EventsGateway } from '../events/events.gateway';
import { QueueService, type PreflightJobData } from '../queue/queue.service';
import { PreflightService } from './preflight.service';

/**
 * Consumes the preflight queue.
 *
 * Runs in the API process rather than a separate container — see QueueService
 * for why. Concurrency is one, so this is deliberately the only place in the
 * app that spends serious CPU.
 */
@Injectable()
export class PreflightWorker implements OnModuleInit {
  private readonly logger = new Logger(PreflightWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly preflight: PreflightService,
    private readonly jobs: JobsService,
    private readonly events: EventsGateway,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.workPreflight((data) => this.run(data));
    this.logger.log('preflight worker registered');
  }

  private async run(data: PreflightJobData): Promise<void> {
    const started = Date.now();
    this.logger.log(`preflight ${data.jobReference} — ${data.fileName}`);

    /**
     * Each check is emitted the instant it lands rather than the whole report at
     * the end. The checks take very different amounts of time — pdfinfo is
     * instant, ghostscript's ink coverage is not — so a progressive report is
     * genuinely more informative than a spinner, and it is the reason the seam
     * was defined as a subscription in the first place.
     */
    const report = await this.preflight.analyse(
      data.jobReference,
      data.filePath,
      data.fileName,
      (reportId, check, index, total) => {
        this.events.emitPreflightCheck(data.jobReference, { reportId, check, index, total });
      },
    );

    const blocked = hasBlockingFailure(report);
    this.events.emitPreflightDone(data.jobReference, {
      reportId: report.id,
      blocked,
      total: report.checks.length,
    });
    const counts = report.checks.reduce<Record<string, number>>((acc, check) => {
      acc[check.severity] = (acc[check.severity] ?? 0) + 1;
      return acc;
    }, {});

    this.logger.log(
      `preflight ${data.jobReference} done in ${Date.now() - started}ms — ` +
        `${counts.PASS ?? 0} pass, ${counts.WARN ?? 0} warn, ${counts.FAIL ?? 0} fail, ` +
        `${counts.SKIPPED ?? 0} not run`,
    );

    /**
     * A clean report moves the job on by itself; a blocking failure does not.
     * That is the whole point of the FAIL severity — the job stops at PREFLIGHT
     * until a technician overrides with a recorded reason, and nothing about
     * that decision is automatic.
     */
    if (blocked) {
      this.logger.warn(
        `${data.jobReference} held at PREFLIGHT: ${counts.FAIL} blocking failure(s).`,
      );
      return;
    }

    try {
      await this.jobs.transition(data.jobReference, 'PROOFING', SYSTEM_ACTOR, {
        proofState: 'AWAITING_APPROVAL',
        reason: 'Preflight clear. Proof issued.',
      });
    } catch (error) {
      // The job may have been held or cancelled while preflight was running.
      // Losing the transition is fine; the report is already saved.
      this.logger.warn(
        `${data.jobReference} could not advance to PROOFING: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
