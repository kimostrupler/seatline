import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminOnly, BillingExempt, Ctx, Public } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { ZodPipe } from '../common/zod.pipe';
import { BillingService } from './billing.service';

const returnSchema = z.strictObject({ returnUrl: z.url() });

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @AdminOnly()
  @Get()
  overview(@Ctx() ctx: RequestContext) {
    return this.billing.overview(ctx);
  }

  /** Works while read-only too: it's how a workspace gets back to normal. */
  @AdminOnly()
  @BillingExempt()
  @Post('checkout')
  checkout(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(returnSchema)) body: { returnUrl: string },
  ) {
    return this.billing.checkout(ctx, body.returnUrl);
  }

  @AdminOnly()
  @BillingExempt()
  @Post('portal')
  portal(@Ctx() ctx: RequestContext, @Body(new ZodPipe(returnSchema)) body: { returnUrl: string }) {
    return this.billing.portal(ctx, body.returnUrl);
  }

  /** Stripe's webhook (no sign-in; verified by its signature). */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
    return this.billing.webhook(req.rawBody, signature);
  }
}
