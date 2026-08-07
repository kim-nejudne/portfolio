import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Job, JobState, QuoteInput, Role } from '@forme/domain';
import { Roles, User } from '../common/decorators';
import type { CurrentUser } from '../common/types';
import { DenyDemoWritesGuard, RolesGuard } from '../auth/guards';
import { JobsService, actorOf } from './jobs.service';

const ALL_STATES: JobState[] = [
  'ESTIMATE',
  'ARTWORK_RECEIVED',
  'PREFLIGHT',
  'PROOFING',
  'APPROVED',
  'IMPOSED',
  'PLATED',
  'ON_PRESS',
  'FINISHING',
  'DESPATCHED',
  'HELD',
  'CANCELLED',
];

class CreateJobDto {
  @IsString()
  @MinLength(3, { message: 'Describe the job so the floor knows what it is.' })
  @MaxLength(200)
  description!: string;

  /**
   * Needs a decorator even though the real validation is the domain's
   * validateQuoteInput: the global ValidationPipe runs with `whitelist`, which
   * strips every property that has no validator attached. Without this the spec
   * silently vanished before the service ever saw it.
   */
  @IsObject()
  spec!: Record<string, unknown>;
}

class RejectProofDto {
  @IsString()
  @MinLength(4, { message: 'Say what is wrong with the proof so prepress can act on it.' })
  @MaxLength(2000)
  reason!: string;
}

class CommentDto {
  @IsString()
  @MinLength(1, { message: 'Write something before posting.' })
  @MaxLength(4000)
  body!: string;
}

class TransitionDto {
  @IsIn(ALL_STATES, { message: 'Not a job state.' })
  to!: JobState;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

@ApiTags('jobs')
@Controller('jobs')
@UseGuards(RolesGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  /**
   * Scoped by role, not by a query parameter. A customer always sees their own
   * account's jobs and nothing else; passing someone else's customerId does
   * nothing, because the filter is derived from the token rather than the URL.
   */
  @Get()
  @ApiOperation({ summary: 'Jobs visible to the caller' })
  async list(@User() user: CurrentUser, @Query('state') state?: string): Promise<{ jobs: Job[] }> {
    const states = parseStates(state);
    const jobs = await this.jobs.list({
      ...(user.role === 'customer' && user.customerId ? { customerId: user.customerId } : {}),
      ...(states.length ? { states } : {}),
    });
    return { jobs };
  }

  @Get('queue')
  @Roles('prepress', 'admin')
  @ApiOperation({ summary: 'The prepress queue, every customer, due time first' })
  async queue(): Promise<{ jobs: Job[] }> {
    return { jobs: await this.jobs.prepressQueue() };
  }

  /**
   * Submit a job. The customer comes from the token, not the body — a customer
   * cannot file a job against somebody else's account by editing the payload.
   */
  @Post()
  @Roles('customer', 'prepress', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Create a job' })
  async create(@Body() dto: CreateJobDto, @User() user: CurrentUser): Promise<{ job: Job }> {
    const customerId = user.customerId ?? (dto.spec['customerId'] as string | undefined);
    if (!customerId) {
      throw new BadRequestException('This account is not attached to a customer.');
    }
    return {
      job: await this.jobs.create(
        {
          customerId,
          description: dto.description,
          spec: dto.spec as unknown as QuoteInput,
        },
        actorOf(user),
      ),
    };
  }

  @Get(':reference')
  @ApiOperation({ summary: 'One job' })
  async get(
    @Param('reference') reference: string,
    @User() user: CurrentUser,
  ): Promise<{ job: Job }> {
    return { job: await this.jobs.get(reference, user) };
  }

  @Post(':reference/approve')
  @Roles('customer', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Approve the proof and lock the artwork' })
  async approve(
    @Param('reference') reference: string,
    @User() user: CurrentUser,
  ): Promise<{ job: Job }> {
    return { job: await this.jobs.approveProof(reference, user) };
  }

  @Post(':reference/reject')
  @Roles('customer', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Reject the proof and send the job back to preflight' })
  async reject(
    @Param('reference') reference: string,
    @Body() dto: RejectProofDto,
    @User() user: CurrentUser,
  ): Promise<{ job: Job }> {
    return { job: await this.jobs.rejectProof(reference, dto.reason, user) };
  }

  @Post(':reference/comments')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Add a comment to the job thread' })
  async comment(
    @Param('reference') reference: string,
    @Body() dto: CommentDto,
    @User() user: CurrentUser,
  ): Promise<{ job: Job }> {
    await this.jobs.get(reference, user);
    await this.jobs.comment(reference, dto.body, actorOf(user));
    return { job: await this.jobs.get(reference, user) };
  }

  /**
   * The general transition endpoint, for the states a person drives from the
   * floor or prepress. The state machine decides what is legal; this only
   * decides who is allowed to ask.
   */
  @Patch(':reference/state')
  @Roles('prepress', 'floor', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Move a job to another state' })
  async transition(
    @Param('reference') reference: string,
    @Body() dto: TransitionDto,
    @User() user: CurrentUser,
  ): Promise<{ job: Job }> {
    return {
      job: await this.jobs.transition(reference, dto.to, actorOf(user), {
        ...(dto.reason ? { reason: dto.reason } : {}),
      }),
    };
  }
}

function parseStates(raw: string | undefined): JobState[] {
  if (!raw) return [];
  const wanted = raw.split(',').map((value) => value.trim().toUpperCase());
  return ALL_STATES.filter((state) => wanted.includes(state));
}

export type { Role };
