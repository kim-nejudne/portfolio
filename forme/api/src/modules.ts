/**
 * The smaller feature modules.
 *
 * Jobs, auth and preflight each earn their own directory because they carry a
 * repository, a worker or a state machine. These five are a controller and a
 * few lines of service each, and splitting them across fifteen files would be
 * ceremony rather than structure.
 */
import { Body, Controller, Get, Inject, Injectable, Module, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Min } from 'class-validator';
import { asc, eq } from 'drizzle-orm';
import {
  DEFAULT_QUOTE_INPUT,
  SHEETS,
  buildPlan,
  computeQuote,
  validateQuoteInput,
  type BindingStyle,
  type Customer,
  type ImpositionInput,
  type ImpositionPlan,
  type PriceCellGroup,
  type PriceMatrix,
  type Press,
  type PressId,
  type QuoteInput,
  type QuoteResult,
  type SheetId,
  type SignatureScheme,
  type SizeId,
  type WorkStyle,
} from '@forme/domain';
import { Public, Roles, SkipAudit } from './common/decorators';
import { DenyDemoWritesGuard, RolesGuard } from './auth/guards';
import { DATABASE, type Database } from './db/database.module';
import { customers, jobs, presses } from './db/schema';
import { PricingService } from './pricing/pricing.service';

/* ----------------------------------------------------------------- quotes */

@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly pricing: PricingService) {}

  /**
   * Public: the marketing calculator has no session. The response is computed
   * from the live matrix, so a quoted price is the price the API would charge.
   */
  @Public()
  @SkipAudit()
  @Get()
  @ApiOperation({ summary: 'Price a specification' })
  async quote(@Query() query: Record<string, string>): Promise<{
    quote: QuoteResult | null;
    errors: { field: string; message: string }[];
  }> {
    const input = coerceQuoteInput(query);
    const errors = validateQuoteInput(input);
    if (errors.length > 0) {
      return { quote: null, errors: errors.map((e) => ({ field: e.field, message: e.message })) };
    }
    const matrix = await this.pricing.getMatrix();
    return { quote: computeQuote(input, matrix, new Date().toISOString()), errors: [] };
  }
}

/** Query strings arrive as strings; the domain's closed sets do the validating. */
function coerceQuoteInput(query: Record<string, string>): QuoteInput {
  const finishing = (query.finishing ?? 'trim').split(',').filter(Boolean);
  const pages = Number.parseInt(query.pages ?? '', 10);
  return {
    product: (query.product ?? DEFAULT_QUOTE_INPUT.product) as QuoteInput['product'],
    size: (query.size ?? DEFAULT_QUOTE_INPUT.size) as SizeId,
    pageCount: Number.isFinite(pages) ? pages : null,
    stock: (query.stock ?? DEFAULT_QUOTE_INPUT.stock) as QuoteInput['stock'],
    colours: (query.colours ?? DEFAULT_QUOTE_INPUT.colours) as QuoteInput['colours'],
    quantity: Number.parseInt(query.quantity ?? '', 10) || DEFAULT_QUOTE_INPUT.quantity,
    finishing: finishing as QuoteInput['finishing'],
    turnaround: (query.turnaround ?? DEFAULT_QUOTE_INPUT.turnaround) as QuoteInput['turnaround'],
  };
}

@Module({ controllers: [QuotesController], providers: [PricingService], exports: [PricingService] })
export class QuotesModule {}

/* ---------------------------------------------------------------- pricing */

class PriceEditDto {
  @IsIn(['products', 'stocks', 'quantityBreaks', 'finishing', 'turnarounds'])
  group!: PriceCellGroup;

  @IsString() rowId!: string;
  @IsString() field!: string;

  @IsInt({ message: 'Whole numbers only. No decimals, no currency symbols.' })
  @Min(0)
  value!: number;
}

@ApiTags('pricing')
@Controller('pricing')
@UseGuards(RolesGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  /** Public because the marketing pages render rates from it. */
  @Public()
  @SkipAudit()
  @Get()
  @ApiOperation({ summary: 'The price matrix' })
  async matrix(): Promise<{ matrix: PriceMatrix }> {
    return { matrix: await this.pricing.getMatrix() };
  }

  @Patch()
  @Roles('admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Update one rate cell' })
  async update(@Body() dto: PriceEditDto): Promise<{ matrix: PriceMatrix }> {
    return { matrix: await this.pricing.updateCell(dto) };
  }
}

@Module({ controllers: [PricingController], providers: [PricingService], exports: [PricingService] })
export class PricingModule {}

/* ------------------------------------------------------------- imposition */

@ApiTags('imposition')
@Controller('imposition')
@UseGuards(RolesGuard)
export class ImpositionController {
  constructor(private readonly pricing: PricingService) {}

  /**
   * The planner recomputes locally on every slider drag using the same
   * `buildPlan` from @forme/domain, so this endpoint exists for the authoritative
   * plan that gets persisted — not for the interaction.
   */
  @Roles('prepress', 'admin')
  @Get('plan')
  @SkipAudit()
  @ApiOperation({ summary: 'Compute an imposition plan' })
  async plan(@Query() query: Record<string, string>): Promise<{ plan: ImpositionPlan }> {
    const matrix = await this.pricing.getMatrix();
    const input: ImpositionInput = {
      sheetId: (query.sheetId ?? 'B2') as SheetId,
      sizeId: (query.sizeId ?? 'A5') as SizeId,
      scheme: (query.scheme ?? '8pp') as SignatureScheme,
      binding: (query.binding ?? 'saddle-stitch') as BindingStyle,
      workStyle: (query.workStyle ?? 'sheetwise') as WorkStyle,
      gripperMm: Number(query.gripperMm ?? 10),
      creepMm: Number(query.creepMm ?? 0),
      pageCount: Number(query.pageCount ?? 16),
      quantity: Number(query.quantity ?? 1000),
    };
    const size = matrix.sizes.find((entry) => entry.id === input.sizeId);
    return {
      plan: buildPlan(input, size?.widthMm ?? 148, size?.heightMm ?? 210),
    };
  }
}

@Module({ controllers: [ImpositionController], providers: [PricingService] })
export class ImpositionModule {}

/* ----------------------------------------------------------------- presses */

@Injectable()
export class PressesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(): Promise<Press[]> {
    const rows = await this.db
      .select({ press: presses, job: jobs, customer: customers })
      .from(presses)
      .leftJoin(jobs, eq(jobs.reference, presses.jobReference))
      .leftJoin(customers, eq(customers.id, jobs.customerId))
      .orderBy(asc(presses.sortOrder));

    return rows.map(({ press, job, customer }) => ({
      id: press.id as PressId,
      name: press.name,
      kind: press.kind,
      units: press.units,
      maxSheet: press.maxSheet as SheetId,
      maxSheetMm: press.maxSheetMm,
      notes: press.notes,
      state: press.state,
      jobReference: press.jobReference,
      jobDescription: job?.description ?? null,
      customer: customer?.shortName ?? null,
      sheetsRun: press.sheetsRun,
      sheetsTarget: press.sheetsTarget,
      wasteSheets: press.wasteSheets,
      sheetsPerHour: press.sheetsPerHour,
      // Derived rather than stored: a stored countdown goes stale the moment
      // nothing updates it, and a floor board showing a frozen ETA is worse
      // than one showing none.
      minutesRemaining: minutesRemaining(press.sheetsTarget, press.sheetsRun, press.sheetsPerHour),
      operator: press.operator,
      shift: press.shift,
      queue: [],
    }));
  }
}

function minutesRemaining(target: number, run: number, perHour: number): number {
  if (perHour <= 0) return 0;
  return Math.max(Math.round(((target - run) / perHour) * 60), 0);
}

@ApiTags('presses')
@Controller('presses')
@UseGuards(RolesGuard)
export class PressesController {
  constructor(private readonly presses: PressesService) {}

  /** Public: the marketing page lists the shop's kit from the same source. */
  @Public()
  @SkipAudit()
  @Get()
  @ApiOperation({ summary: 'Every press and what it is running' })
  async list(): Promise<{ presses: Press[] }> {
    return { presses: await this.presses.list() };
  }
}

@Module({ controllers: [PressesController], providers: [PressesService], exports: [PressesService] })
export class PressesModule {}

/* --------------------------------------------------------------- customers */

@ApiTags('customers')
@Controller('customers')
@UseGuards(RolesGuard)
export class CustomersController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Roles('prepress', 'admin')
  @Get()
  @SkipAudit()
  @ApiOperation({ summary: 'Every account' })
  async list(): Promise<{ customers: Customer[] }> {
    const rows = await this.db.select().from(customers).orderBy(asc(customers.name));
    return { customers: rows.map(({ createdAt: _createdAt, ...rest }) => rest) };
  }
}

@Module({ controllers: [CustomersController] })
export class CustomersModule {}

export { SHEETS };
