import { Controller, Get, HttpCode } from '@nestjs/common';
import { Ctx } from '../auth/decorators';
import type { RequestContext } from '../auth/request-context';
import { OwnerService } from './owner.service';

/** The operator's dashboard (OWNER_EMAILS only; a 404 for everyone else). */
@Controller('owner')
export class OwnerController {
  constructor(private readonly owner: OwnerService) {}

  /** 204 for the operator (the app then shows a menu link), the same 404 for everyone else. */
  @Get('check')
  @HttpCode(204)
  async check(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/check');
  }

  @Get('overview')
  async overview(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/overview');
    return this.owner.overview();
  }
}
