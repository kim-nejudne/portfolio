import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { eq } from 'drizzle-orm';
import type { StoredFile } from '@forme/domain';
import { Roles, User } from '../common/decorators';
import type { CurrentUser } from '../common/types';
import { DenyDemoWritesGuard, RolesGuard } from '../auth/guards';
import { DATABASE, type Database } from '../db/database.module';
import { jobFiles, jobs } from '../db/schema';
import { JobsService, actorOf } from '../jobs/jobs.service';
import { QueueService } from '../queue/queue.service';
import { ArtworkService } from './artwork.service';

@ApiTags('artwork')
@Controller('jobs/:reference/artwork')
@UseGuards(RolesGuard)
export class ArtworkController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly artwork: ArtworkService,
    private readonly jobs: JobsService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Receives artwork and queues preflight.
   *
   * Multer writes to a temp file rather than memory: a 200MB buffer per
   * concurrent upload is how a 1.9GB box falls over. The limit is enforced
   * twice — multer aborts the stream at the cap so a hostile client cannot
   * fill the disk, and ArtworkService re-checks the file it actually received.
   */
  @Post()
  @Roles('customer', 'prepress', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload artwork and queue preflight' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const staging = ArtworkService.stagingDir();
          mkdirSync(staging, { recursive: true });
          callback(null, staging);
        },
        filename: (_request, _file, callback) => callback(null, `forme-${randomUUID()}`),
      }),
      limits: {
        fileSize: Number(process.env.ARTWORK_MAX_BYTES ?? 200 * 1024 * 1024),
        files: 1,
      },
    }),
  )
  async upload(
    @Param('reference') reference: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @User() user: CurrentUser,
  ): Promise<{ stored: StoredFile; reportQueued: boolean }> {
    if (!file) throw new BadRequestException('No file was uploaded.');

    // Ownership before anything touches the disk, and via the service so a
    // customer asking about another account's job gets the same 404 they would
    // anywhere else.
    const job = await this.jobs.get(reference, user);

    const stored = await this.artwork.store(file.path, file.originalname);

    await this.db.insert(jobFiles).values({
      id: randomUUID(),
      jobReference: reference,
      name: stored.name,
      kind: 'PDF',
      bytes: stored.bytes,
      contentHash: stored.contentHash,
      storagePath: stored.storagePath,
    });

    /**
     * Walk the job to PREFLIGHT one legal step at a time rather than assigning
     * the state. A job at PROOFING receiving replacement artwork goes back
     * through PREFLIGHT properly, and one already there just re-runs.
     */
    const actor = actorOf(user);
    if (job.state === 'ESTIMATE') {
      await this.jobs.transition(reference, 'ARTWORK_RECEIVED', actor);
    }
    const current = await this.jobs.get(reference, user);
    if (current.state === 'ARTWORK_RECEIVED' || current.state === 'PROOFING') {
      await this.jobs.transition(reference, 'PREFLIGHT', actor, {
        reason: `Artwork received: ${stored.name}`,
      });
    }

    // Clear the previous report so the portal shows this upload being checked
    // rather than the last one's verdict.
    await this.db
      .update(jobs)
      .set({ preflightReportId: null, updatedAt: new Date() })
      .where(eq(jobs.reference, reference));

    const queued = await this.queue.enqueuePreflight({
      jobReference: reference,
      filePath: stored.storagePath,
      fileName: stored.name,
      actorName: user.name,
    });

    return {
      stored: { name: stored.name, bytes: stored.bytes, at: new Date().toISOString() },
      reportQueued: queued !== null,
    };
  }
}
