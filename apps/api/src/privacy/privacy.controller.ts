import { Body, Controller, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { sendDpaSchema, type SendDpaInput } from '@seatline/shared';
import type { Response } from 'express';
import { AdminOnly, BillingExempt, Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
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

/** Admins: the DPA as a PDF, by e-mail to themselves. */
@AdminOnly()
@Controller('privacy/dpa')
export class DpaController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post()
  @BillingExempt() // a read-only workspace may still need its contract
  send(@Ctx() ctx: RequestContext, @Body(new ZodPipe(sendDpaSchema)) body: SendDpaInput) {
    return this.privacy.sendDpa(ctx, body.language);
  }
}
