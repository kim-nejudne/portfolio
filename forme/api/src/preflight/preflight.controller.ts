import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { PreflightCheckId, PreflightReport } from '@forme/domain';
import { Roles, User } from '../common/decorators';
import type { CurrentUser } from '../common/types';
import { DenyDemoWritesGuard, RolesGuard } from '../auth/guards';
import { PreflightService } from './preflight.service';

const CHECK_IDS: PreflightCheckId[] = [
  'trim-size',
  'bleed',
  'safety-margin',
  'fonts-embedded',
  'image-resolution',
  'colour-space',
  'total-area-coverage',
  'spot-colours',
  'white-overprint',
  'hairlines',
  'page-count',
  'pdfx4',
];

class WaiverDto {
  @IsIn(CHECK_IDS, { message: 'Not a preflight check.' })
  checkId!: PreflightCheckId;

  @IsIn(['WAIVED', 'OVERRIDDEN'])
  kind!: 'WAIVED' | 'OVERRIDDEN';

  /**
   * Eight characters minimum. This text goes on the job's permanent record as
   * the justification for putting a known defect on press, so "ok" is not an
   * acceptable answer.
   */
  @IsString()
  @MinLength(8, {
    message: 'Give a real reason. It goes on the job record against your name, permanently.',
  })
  @MaxLength(2000)
  reason!: string;
}

@ApiTags('preflight')
@Controller('preflight')
@UseGuards(RolesGuard)
export class PreflightController {
  constructor(private readonly preflight: PreflightService) {}

  @Get(':reportId')
  @ApiOperation({ summary: 'A preflight report' })
  async report(@Param('reportId') reportId: string): Promise<{ report: PreflightReport }> {
    const report = await this.preflight.findReport(reportId);
    if (!report) throw new NotFoundException(`No report ${reportId}.`);
    return { report };
  }

  @Post(':reportId/waive')
  @Roles('prepress', 'admin')
  @UseGuards(DenyDemoWritesGuard)
  @ApiOperation({ summary: 'Waive a warning or override a failure, with a recorded reason' })
  async waive(
    @Param('reportId') reportId: string,
    @Body() dto: WaiverDto,
    @User() user: CurrentUser,
  ): Promise<{ report: PreflightReport }> {
    const report = await this.preflight.applyWaiver(reportId, dto.checkId, {
      reason: dto.reason,
      by: user.name,
      at: new Date().toISOString(),
      kind: dto.kind,
    });
    return { report };
  }
}
