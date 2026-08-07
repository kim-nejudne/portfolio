import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ArrayMaxSize, IsArray, IsString, MinLength } from 'class-validator';
import type { PullResponse, PushResponse } from '@suki/domain';
import { SyncService } from './sync.service';

class PushDto {
  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsArray()
  // A phone offline for a week still batches; this bounds one request without
  // bounding the queue, because the client pages through what is left.
  @ArrayMaxSize(500)
  operations!: {
    id: string;
    type: string;
    payload: unknown;
    createdAt: string;
  }[];
}

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /**
   * Safe to call with operations the server already has — see SyncService.push.
   * A client that is unsure whether its last request landed should simply send
   * again rather than try to find out.
   */
  @Post('push')
  @HttpCode(200)
  @Throttle({ push: { limit: 120, ttl: 60_000 } })
  async push(@Body() dto: PushDto): Promise<PushResponse> {
    return this.sync.push(dto.clientId, dto.operations as never);
  }

  @Get('pull')
  @Throttle({ pull: { limit: 240, ttl: 60_000 } })
  async pull(
    @Query('clientId') clientId: string,
    @Query('since') since?: string,
  ): Promise<PullResponse> {
    const from = Number.parseInt(since ?? '0', 10);
    return this.sync.pull(clientId, Number.isFinite(from) && from > 0 ? from : 0);
  }

  @Get('rejections')
  async rejections(@Query('clientId') clientId: string) {
    return { rejections: await this.sync.rejectionsFor(clientId) };
  }
}
