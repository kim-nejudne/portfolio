import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  PREPRESS_STATES,
  assertTransition,
  buildJob,
  computeQuote,
  hasBlockingFailure,
  validateQuoteInput,
  type Job,
  type JobState,
  type PriceMatrix,
  type QuoteInput,
  type Role,
} from '@forme/domain';
import { DATABASE, type Database } from '../db/database.module';
import { jobComments, jobEvents, jobs } from '../db/schema';
import type { CurrentUser } from '../common/types';
import { PricingService } from '../pricing/pricing.service';
import { EventsGateway } from '../events/events.gateway';
import { JobsRepository, type JobBundle } from './jobs.repository';

export interface Actor {
  id: string | null;
  name: string;
  role: Role;
}

export function actorOf(user: CurrentUser): Actor {
  return { id: user.id, name: user.name, role: user.role };
}

/** The system moving a job on its own — the preflight worker, a cron. */
export const SYSTEM_ACTOR: Actor = { id: null, name: 'FORME', role: 'prepress' };

@Injectable()
export class JobsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: JobsRepository,
    private readonly pricing: PricingService,
    private readonly events: EventsGateway,
  ) {}

  private compose(bundle: JobBundle, matrix: PriceMatrix): Job {
    return buildJob(bundle.record, {
      customer: bundle.customer,
      matrix,
      blocked: hasBlockingFailure(bundle.report),
    });
  }

  async list(filter: { customerId?: string; states?: readonly JobState[] }): Promise<Job[]> {
    const [bundles, matrix] = await Promise.all([
      this.repository.findBundles(filter),
      this.pricing.getMatrix(),
    ]);
    return bundles.map((bundle) => this.compose(bundle, matrix));
  }

  async prepressQueue(): Promise<Job[]> {
    return this.list({ states: PREPRESS_STATES });
  }

  /**
   * Fetches one job, scoped to the caller.
   *
   * A customer asking for another account's job gets 404, not 403: a 403 would
   * confirm the reference exists, which is enough to enumerate the shop's
   * customers one job number at a time.
   */
  async get(reference: string, user: CurrentUser): Promise<Job> {
    const [bundle, matrix] = await Promise.all([
      this.repository.findBundle(reference),
      this.pricing.getMatrix(),
    ]);
    if (!bundle) throw new NotFoundException(`No job ${reference}.`);
    if (user.role === 'customer' && bundle.record.customerId !== user.customerId) {
      throw new NotFoundException(`No job ${reference}.`);
    }
    return this.compose(bundle, matrix);
  }

  /**
   * The only way a job changes state.
   *
   * The guard, the row update and the event insert happen in one transaction, so
   * there is never a job whose state moved without a matching event, and never
   * an event for a move that did not take.
   */
  async transition(
    reference: string,
    to: JobState,
    actor: Actor,
    options: { reason?: string; proofState?: 'APPROVED' | 'REJECTED' | 'AWAITING_APPROVAL' } = {},
  ): Promise<Job> {
    await this.db.transaction(async (tx) => {
      // FOR UPDATE: two operators clicking Approve at the same moment must
      // serialise, or both read PROOFING and both write an APPROVED event.
      const [current] = await tx
        .select()
        .from(jobs)
        .where(eq(jobs.reference, reference))
        .for('update')
        .limit(1);

      if (!current) throw new NotFoundException(`No job ${reference}.`);

      assertTransition(current.state, to);

      const now = new Date();
      await tx
        .update(jobs)
        .set({
          state: to,
          updatedAt: now,
          ...(options.proofState ? { proofState: options.proofState, proofAt: now } : {}),
          // A note explains a hold or a cancellation; moving on clears it.
          note: to === 'HELD' || to === 'CANCELLED' ? (options.reason ?? null) : null,
        })
        .where(eq(jobs.reference, reference));

      await tx.insert(jobEvents).values({
        id: randomUUID(),
        jobReference: reference,
        fromState: current.state,
        toState: to,
        actorId: actor.id,
        actorName: actor.name,
        reason: options.reason ?? null,
        at: now,
      });
    });

    const [bundle, matrix] = await Promise.all([
      this.repository.findBundle(reference),
      this.pricing.getMatrix(),
    ]);
    if (!bundle) throw new NotFoundException(`No job ${reference}.`);

    // Emitted after the transaction commits, never inside it: a subscriber that
    // reacted by re-reading the job could otherwise beat the commit and see the
    // old state.
    this.events.emitJobState(reference, bundle.record.state, bundle.record.proofState);

    return this.compose(bundle, matrix);
  }

  async approveProof(reference: string, user: CurrentUser): Promise<Job> {
    const job = await this.get(reference, user);
    if (job.customerId !== user.customerId && user.role === 'customer') {
      throw new NotFoundException(`No job ${reference}.`);
    }
    const updated = await this.transition(reference, 'APPROVED', actorOf(user), {
      proofState: 'APPROVED',
    });
    await this.comment(
      reference,
      'Proof approved. Artwork locked for press.',
      actorOf(user),
    );
    return updated;
  }

  async rejectProof(reference: string, reason: string, user: CurrentUser): Promise<Job> {
    await this.get(reference, user);
    const updated = await this.transition(reference, 'PREFLIGHT', actorOf(user), {
      reason,
      proofState: 'REJECTED',
    });
    await this.comment(reference, `Proof rejected. ${reason}`, actorOf(user));
    return updated;
  }

  async comment(reference: string, body: string, actor: Actor): Promise<void> {
    await this.db.insert(jobComments).values({
      id: randomUUID(),
      jobReference: reference,
      author: actor.name,
      role: actor.role,
      body,
    });
  }

  /**
   * Creates a job. The quote is recomputed server-side from the submitted spec —
   * the client's number is never trusted, and the due date follows from it.
   */
  async create(
    input: { customerId: string; description: string; spec: QuoteInput },
    actor: Actor,
  ): Promise<Job> {
    const errors = validateQuoteInput(input.spec);
    if (errors.length > 0) {
      throw new ForbiddenException(errors.map((error) => error.message).join(' '));
    }

    const matrix = await this.pricing.getMatrix();
    const now = new Date();
    const quote = computeQuote(input.spec, matrix, now.toISOString());

    const reference = await this.db.transaction(async (tx) => {
      const next = await this.repository.nextReference(tx as unknown as Database, now);
      await tx.insert(jobs).values({
        reference: next,
        customerId: input.customerId,
        description: input.description,
        spec: input.spec,
        state: 'ESTIMATE',
        receivedAt: now,
        dueAt: new Date(quote.despatchAt),
        proofState: 'NONE',
      });
      await tx.insert(jobEvents).values({
        id: randomUUID(),
        jobReference: next,
        fromState: null,
        toState: 'ESTIMATE',
        actorId: actor.id,
        actorName: actor.name,
        at: now,
      });
      return next;
    });

    const [bundle, freshMatrix] = await Promise.all([
      this.repository.findBundle(reference),
      this.pricing.getMatrix(),
    ]);
    if (!bundle) throw new NotFoundException(`No job ${reference}.`);
    return this.compose(bundle, freshMatrix);
  }
}
