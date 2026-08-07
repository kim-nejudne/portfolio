import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, rename, rm, stat } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { BadRequestException, Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StoredArtwork {
  name: string;
  bytes: number;
  contentHash: string;
  storagePath: string;
  /** True when these exact bytes were already on disk for another job. */
  deduplicated: boolean;
}

/** `%PDF-` — the first five bytes of every PDF, whatever the extension says. */
const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

@Injectable()
export class ArtworkService {
  private readonly logger = new Logger(ArtworkService.name);
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(config: ConfigService) {
    this.root = resolve(config.get<string>('ARTWORK_DIR', './.artwork'));
    this.maxBytes = config.get<number>('ARTWORK_MAX_BYTES', 200 * 1024 * 1024);
  }

  get maxUploadBytes(): number {
    return this.maxBytes;
  }

  /**
   * Where multer writes before the file is accepted.
   *
   * Inside the artwork root on purpose, not the system temp directory: /tmp is
   * usually tmpfs, and moving a file off it is a cross-device rename, which
   * fails with EXDEV. Staging on the same filesystem keeps the move atomic and
   * free rather than a 200MB copy.
   */
  static stagingDir(): string {
    return join(resolve(process.env.ARTWORK_DIR ?? './.artwork'), '.incoming');
  }

  async ensureRoot(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await mkdir(ArtworkService.stagingDir(), { recursive: true });
  }

  /**
   * Moves an uploaded temp file into permanent storage.
   *
   * Three things the scaffold's version did not do, each of which matters:
   *
   * - **Checks the magic bytes**, not the extension. Anyone can name a zip
   *   `artwork.pdf`, and the preflight worker would then hand it to ghostscript.
   * - **Names the file by content hash.** The scaffold used the job reference
   *   plus the original filename, so uploading `artwork.pdf` twice to the same
   *   job silently overwrote the first — including for a job already at proof.
   * - **Deletes the temp file on every path**, including the failures, so a
   *   rejected 200MB upload does not stay on disk forever.
   */
  async store(tempPath: string, originalName: string): Promise<StoredArtwork> {
    try {
      const info = await stat(tempPath);
      if (info.size === 0) {
        throw new BadRequestException('That file is empty.');
      }
      if (info.size > this.maxBytes) {
        throw new PayloadTooLargeException(
          `Artwork must be under ${Math.floor(this.maxBytes / 1024 / 1024)}MB. That file is ${Math.ceil(info.size / 1024 / 1024)}MB.`,
        );
      }

      await this.assertPdf(tempPath);

      const contentHash = await this.hash(tempPath);
      await this.ensureRoot();

      // Two levels of fan-out so a directory listing stays usable after a few
      // thousand jobs.
      const shard = join(this.root, contentHash.slice(0, 2), contentHash.slice(2, 4));
      await mkdir(shard, { recursive: true });
      const storagePath = join(shard, `${contentHash}.pdf`);

      let deduplicated = true;
      try {
        await stat(storagePath);
      } catch {
        deduplicated = false;
        try {
          await rename(tempPath, storagePath);
        } catch (error) {
          // Belt and braces: staging lives on the same filesystem, but if the
          // artwork directory is ever a mount of its own, fall back to a copy
          // rather than losing the upload.
          if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
          this.logger.warn('artwork staging is on another filesystem; copying instead');
          await copyFile(tempPath, storagePath);
        }
      }

      return {
        name: safeName(originalName),
        bytes: info.size,
        contentHash,
        storagePath,
        deduplicated,
      };
    } finally {
      // rename() already consumed the temp file on the happy path; this cleans
      // up every other one.
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }

  private async assertPdf(path: string): Promise<void> {
    const handle = await open(path, 'r');
    try {
      const buffer = Buffer.alloc(PDF_MAGIC.length);
      const { bytesRead } = await handle.read(buffer, 0, PDF_MAGIC.length, 0);
      if (bytesRead < PDF_MAGIC.length || !buffer.equals(PDF_MAGIC)) {
        throw new BadRequestException(
          'That file is not a PDF. Supply a PDF/X-4 export — not a packaged InDesign file, an image or an archive.',
        );
      }
    } finally {
      await handle.close();
    }
  }

  private hash(path: string): Promise<string> {
    return new Promise((resolvePromise, reject) => {
      const digest = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('data', (chunk) => digest.update(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolvePromise(digest.digest('hex')));
    });
  }

  /** Removes artwork whose bytes nothing references any more. */
  async remove(storagePath: string): Promise<void> {
    // Never delete outside the artwork root, whatever the database says.
    const target = resolve(storagePath);
    if (!target.startsWith(this.root)) {
      this.logger.warn(`refusing to delete outside the artwork root: ${target}`);
      return;
    }
    await rm(target, { force: true }).catch(() => undefined);
  }
}

/**
 * The display name only. The file on disk is named by hash, so this never
 * reaches the filesystem — but it is rendered in the portal and shipped to the
 * preflight report, so it still gets stripped.
 */
function safeName(name: string): string {
  const base = basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const extension = extname(base).toLowerCase() === '.pdf' ? '' : '.pdf';
  return `${base.slice(0, 120)}${extension}`;
}
