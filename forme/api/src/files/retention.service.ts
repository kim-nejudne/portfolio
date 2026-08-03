import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.module';
import { jobEvents, jobFiles, jobs } from '../db/schema';
import { ArtworkService } from './artwork.service';

/** Staging files older than this were abandoned by a failed upload. */
const STAGING_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Artwork retention.
 *
 * Customer files are not ours to keep forever, and on a droplet with finite
 * disk they are the only thing that grows without bound. This deletes artwork
 * for jobs that finished long enough ago, and sweeps staging files left behind
 * by uploads that failed midway.
 *
 * Deliberately conservative: it removes the *bytes*, not the `job_files` rows.
 * The record of what was supplied, when and how big stays on the job forever —
 * that is part of the audit trail. Only the artwork itself ages out.
 */
@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly retentionDays: number;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly artwork: ArtworkService,
    config: ConfigService,
  ) {
    this.retentionDays = config.get<number>('ARTWORK_RETENTION_DAYS', 90);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweep(): Promise<void> {
    const purged = await this.purgeFinishedJobArtwork();
    const staged = await this.purgeStaleStaging();
    if (purged > 0 || staged > 0) {
      this.logger.log(`retention: ${purged} artwork file(s) purged, ${staged} staging file(s) swept`);
    }
  }

  private async purgeFinishedJobArtwork(): Promise<number> {
    const cutoff = new Date(Date.now() - this.retentionDays * 86_400_000);

    /**
     * "Finished long enough ago" is measured from the event that ended the job,
     * not from `updated_at` — any later write, even a comment, would otherwise
     * keep resetting the clock and nothing would ever age out.
     */
    const finished = await this.db
      .selectDistinct({ reference: jobs.reference })
      .from(jobs)
      .innerJoin(jobEvents, eq(jobEvents.jobReference, jobs.reference))
      .where(
        and(
          inArray(jobs.state, ['DESPATCHED', 'CANCELLED']),
          eq(jobEvents.toState, jobs.state),
          lt(jobEvents.at, cutoff),
        ),
      );

    if (finished.length === 0) return 0;

    const references = finished.map((row) => row.reference);
    const candidates = await this.db
      .select({ storagePath: jobFiles.storagePath, contentHash: jobFiles.contentHash })
      .from(jobFiles)
      .where(inArray(jobFiles.jobReference, references));

    let removed = 0;
    for (const candidate of candidates) {
      if (!candidate.storagePath) continue;

      /**
       * Content-hash storage means one blob can back several jobs. Deleting it
       * because *this* job aged out would silently destroy artwork belonging to
       * a live one, so check nothing else still points at these bytes.
       */
      const [stillReferenced] = await this.db
        .select({ count: sql<string>`count(*)` })
        .from(jobFiles)
        .where(
          and(
            eq(jobFiles.contentHash, candidate.contentHash),
            sql`${jobFiles.jobReference} <> ALL(${references})`,
          ),
        );

      if (Number(stillReferenced?.count ?? '0') > 0) continue;

      await this.artwork.remove(candidate.storagePath);
      // The row stays; only the bytes go. Blank the path so nothing later
      // believes there is still a file behind it.
      await this.db
        .update(jobFiles)
        .set({ storagePath: '' })
        .where(eq(jobFiles.contentHash, candidate.contentHash));
      removed += 1;
    }
    return removed;
  }

  private async purgeStaleStaging(): Promise<number> {
    const staging = ArtworkService.stagingDir();
    let removed = 0;
    try {
      for (const name of await readdir(staging)) {
        const path = join(staging, name);
        const info = await stat(path).catch(() => null);
        if (!info?.isFile()) continue;
        if (Date.now() - info.mtimeMs < STAGING_MAX_AGE_MS) continue;
        await rm(path, { force: true }).catch(() => undefined);
        removed += 1;
      }
    } catch {
      // No staging directory yet means nothing to sweep.
    }
    return removed;
  }
}
