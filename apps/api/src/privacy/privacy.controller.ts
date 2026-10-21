import { Controller, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { AdminOnly, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe } from '../common/zod.pipe';
import { PrivacyService } from './privacy.service';

/** Admins: access requests and forgetting people who left. */
@AdminOnly()
@Controller('privacy/people/:id')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  async export(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.privacy.exportPerson(ctx, id);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="seatline-person-${id.slice(0, 8)}.json"`,
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(Buffer.from(JSON.stringify(data, null, 2), 'utf8'));
  }

  @Post('forget')
  forget(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    return this.privacy.forget(ctx, id);
  }
}
