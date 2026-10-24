import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { Ctx } from '../auth/decorators';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import type { RequestContext } from '../auth/request-context';
import { OwnerService } from './owner.service';

const deleteWorkspaceSchema = z.strictObject({ name: z.string().min(1).max(200) });

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

  /** Support: delete a whole workspace; the body repeats its name as a confirmation. */
  @Delete('workspaces/:id')
  @HttpCode(204)
  async deleteWorkspace(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(deleteWorkspaceSchema)) body: { name: string },
  ) {
    await this.owner.assertOwner(ctx, `/owner/workspaces/${id}`);
    await this.owner.deleteWorkspace(ctx, id, body.name);
  }

  /** Support: a workspace's admin replied "stop" to the onboarding tips; send no more. */
  @Post('workspaces/:id/stop-tips')
  @HttpCode(204)
  async stopTips(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/workspaces/${id}/stop-tips`);
    await this.owner.stopTips(ctx, id);
  }

  @Get('overview')
  async overview(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/overview');
    return this.owner.overview();
  }
}
