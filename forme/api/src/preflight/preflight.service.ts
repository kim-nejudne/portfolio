import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq } from 'drizzle-orm';
import {
  SHEETS,
  hasBlockingFailure,
  type PreflightCheck,
  type PreflightCheckId,
  type PreflightReport,
  type PreflightWaiver,
  type QuoteInput,
  type StockRate,
} from '@forme/domain';
import { DATABASE, type Database } from '../db/database.module';
import { jobs, preflightChecks, preflightReports } from '../db/schema';
import { PricingService } from '../pricing/pricing.service';
import { PREFLIGHT_CHECKS, runCheck, type CheckContext } from './checks';
import {
  ToolUnavailableError,
  ghostscriptBBox,
  ghostscriptInkCoverage,
  pdfFonts,
  pdfImages,
  pdfInfo,
} from './pdf-tools';

export interface PreflightProgress {
  /**
   * `reportId` is passed rather than left for the caller to find: the report row
   * is created before the first check runs, but nothing outside this service
   * knows its id until analyse() returns — which is long after the first check
   * should have been broadcast.
   */
  (reportId: string, check: PreflightCheck, index: number, total: number): void;
}

@Injectable()
export class PreflightService {
  private readonly logger = new Logger(PreflightService.name);
  private readonly timeoutMs: number;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly pricing: PricingService,
    config: ConfigService,
  ) {
    this.timeoutMs = config.get<number>('PREFLIGHT_TIMEOUT_MS', 120_000);
  }

  /**
   * Runs the twelve checks against a file and persists the report.
   *
   * The four external tools run once each, up front, and every check reads from
   * those results — twelve checks must not mean twelve ghostscript invocations
   * on a two-vCPU box. A tool that is missing or fails is recorded in
   * `unavailable`, and the checks that needed it report SKIPPED with the reason
   * rather than passing on absent evidence.
   */
  async analyse(
    jobReference: string,
    filePath: string,
    fileName: string,
    onProgress?: PreflightProgress,
  ): Promise<PreflightReport> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.reference, jobReference)).limit(1);
    if (!job) throw new NotFoundException(`No job ${jobReference}.`);

    const matrix = await this.pricing.getMatrix();
    const spec: QuoteInput = job.spec;
    const size = matrix.sizes.find((entry) => entry.id === spec.size);
    const stock: StockRate =
      matrix.stocks.find((entry) => entry.id === spec.stock) ??
      ({ id: spec.stock, label: spec.stock, gsm: 0, coated: true, inkLimit: 300, multiplier: 1000 } as StockRate);

    const unavailable = new Set<string>();
    const info = await this.safely('pdfinfo', unavailable, () => pdfInfo(filePath, this.timeoutMs));
    if (!info) {
      // Without pdfinfo there is no geometry and no page count; the file is
      // very likely not a PDF at all.
      throw new BadRequestException(
        'That file could not be read as a PDF. Supply a PDF/X-4 export, not a packaged or password-protected file.',
      );
    }

    const [fonts, images, inkCoverage, bboxes] = await Promise.all([
      this.safely('pdffonts', unavailable, () => pdfFonts(filePath, this.timeoutMs)),
      this.safely('pdfimages', unavailable, () => pdfImages(filePath, this.timeoutMs)),
      this.safely('gs', unavailable, () => ghostscriptInkCoverage(filePath, this.timeoutMs)),
      this.safely('gs', unavailable, () => ghostscriptBBox(filePath, this.timeoutMs)),
    ]);

    const context: CheckContext = {
      spec,
      orderedWidthMm: size?.widthMm ?? SHEETS.SRA3.widthMm,
      orderedHeightMm: size?.heightMm ?? SHEETS.SRA3.heightMm,
      stock,
      info,
      fonts: fonts ?? [],
      images: images ?? [],
      inkCoverage: inkCoverage ?? [],
      bboxes: bboxes ?? [],
      unavailable,
    };

    const reportId = `PF-${randomUUID().slice(0, 8).toUpperCase()}`;
    const startedAt = new Date();
    await this.db.insert(preflightReports).values({
      id: reportId,
      jobReference,
      fileName,
      pages: info.pages,
      startedAt,
    });
    await this.db
      .update(jobs)
      .set({ preflightReportId: reportId, updatedAt: new Date() })
      .where(eq(jobs.reference, jobReference));

    const checks: PreflightCheck[] = [];
    for (const [index, definition] of PREFLIGHT_CHECKS.entries()) {
      const outcome = runCheck(definition, context);
      const check: PreflightCheck = {
        id: definition.id,
        label: definition.label,
        severity: outcome.severity,
        measured: outcome.measured,
        tolerance: outcome.tolerance,
        finding: outcome.finding,
        page: outcome.page,
        waiver: null,
      };
      await this.db.insert(preflightChecks).values({
        id: randomUUID(),
        reportId,
        checkId: check.id,
        label: check.label,
        severity: check.severity,
        measured: check.measured,
        tolerance: check.tolerance,
        finding: check.finding,
        page: check.page,
        sortOrder: index,
      });
      checks.push(check);
      // Emitted as each check lands so the intake screen fills in progressively
      // rather than waiting for the whole report.
      onProgress?.(reportId, check, index, PREFLIGHT_CHECKS.length);
    }

    const ranAt = new Date();
    await this.db
      .update(preflightReports)
      .set({ ranAt })
      .where(eq(preflightReports.id, reportId));

    return {
      id: reportId,
      jobReference,
      fileName,
      pages: info.pages,
      ranAt: ranAt.toISOString(),
      checks,
    };
  }

  private async safely<T>(
    tool: string,
    unavailable: Set<string>,
    run: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await run();
    } catch (error) {
      unavailable.add(tool);
      if (error instanceof ToolUnavailableError) {
        this.logger.warn(`${tool} is not installed; dependent checks will report SKIPPED.`);
      } else {
        this.logger.warn(
          `${tool} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return null;
    }
  }

  async findReport(id: string): Promise<PreflightReport | null> {
    const [report] = await this.db
      .select()
      .from(preflightReports)
      .where(eq(preflightReports.id, id))
      .limit(1);
    if (!report) return null;

    const rows = await this.db
      .select()
      .from(preflightChecks)
      .where(eq(preflightChecks.reportId, id))
      .orderBy(asc(preflightChecks.sortOrder));

    return {
      id: report.id,
      jobReference: report.jobReference,
      fileName: report.fileName,
      pages: report.pages,
      ranAt: (report.ranAt ?? report.startedAt).toISOString(),
      checks: rows.map((row) => ({
        id: row.checkId,
        label: row.label,
        severity: row.severity,
        measured: row.measured,
        tolerance: row.tolerance,
        finding: row.finding,
        page: row.page,
        waiver: row.waiver,
      })),
    };
  }

  /**
   * Records a waiver against one check. The reason is required and permanent —
   * it is the record of who took responsibility for putting a known defect on
   * press, which is the entire point of allowing an override at all.
   */
  async applyWaiver(
    reportId: string,
    checkId: PreflightCheckId,
    waiver: PreflightWaiver,
  ): Promise<PreflightReport> {
    const [row] = await this.db
      .select()
      .from(preflightChecks)
      .where(and(eq(preflightChecks.reportId, reportId), eq(preflightChecks.checkId, checkId)))
      .limit(1);
    if (!row) throw new NotFoundException(`No check ${checkId} on report ${reportId}.`);

    if (row.severity === 'SKIPPED') {
      throw new BadRequestException(
        'That check did not run, so there is nothing to waive. Inspect the artwork by hand.',
      );
    }
    if (row.waiver) {
      throw new BadRequestException(
        `Already ${row.waiver.kind.toLowerCase()} by ${row.waiver.by}. A waiver cannot be replaced, only recorded again on a fresh report.`,
      );
    }

    await this.db
      .update(preflightChecks)
      .set({ waiver })
      .where(and(eq(preflightChecks.reportId, reportId), eq(preflightChecks.checkId, checkId)));

    const report = await this.findReport(reportId);
    if (!report) throw new NotFoundException(`No report ${reportId}.`);
    return report;
  }

  /** Whether the job's current report still blocks it from going to proof. */
  async isBlocked(reportId: string | null): Promise<boolean> {
    if (!reportId) return false;
    return hasBlockingFailure(await this.findReport(reportId));
  }
}
