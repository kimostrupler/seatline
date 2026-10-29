import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  leadCreateSchema,
  leadImportSchema,
  leadMessageSchema,
  leadUpdateSchema,
  LEAD_MESSAGE_KINDS,
  type LeadImportInput,
  type LeadInput,
  type LeadMessageKind,
} from '@seatline/shared/dist/outreach';
import { z } from 'zod';
import { Ctx } from '../auth/decorators';
import { IdPipe, ZodPipe } from '../common/zod.pipe';
import type { RequestContext } from '../auth/request-context';
import { LeadsService } from './leads.service';
import { OwnerService } from './owner.service';

const kindSchema = z.enum(LEAD_MESSAGE_KINDS);
const deleteWorkspaceSchema = z.strictObject({ name: z.string().min(1).max(200) });

/** The operator's dashboard (OWNER_EMAILS only; a 404 for everyone else). */
@Controller('owner')
export class OwnerController {
  constructor(
    private readonly owner: OwnerService,
    private readonly leads: LeadsService,
  ) {}

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

  // --- outreach (Leads page): one personal e-mail per lead ---

  @Get('leads')
  async listLeads(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/leads');
    return this.leads.list(ctx);
  }

  @Post('leads')
  async createLead(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(leadCreateSchema)) body: LeadInput & { company: string },
  ) {
    await this.owner.assertOwner(ctx, '/owner/leads');
    return this.leads.create(ctx, body);
  }

  /** Researched leads from a file; ones already there (same company or e-mail) are skipped. */
  @Post('leads/import')
  async importLeads(
    @Ctx() ctx: RequestContext,
    @Body(new ZodPipe(leadImportSchema)) body: LeadImportInput,
  ) {
    await this.owner.assertOwner(ctx, '/owner/leads/import');
    return this.leads.import(ctx, body.leads);
  }

  /** Look in the mailbox for replies and automatic answers now (the page asks on opening). */
  @Post('leads/check-replies')
  async checkReplies(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/leads/check-replies');
    return this.leads.checkRepliesNow(ctx);
  }

  /** "Set up their office": a workspace for the lead, prepared by the operator. */
  @Post('leads/:id/workspace')
  async prepareWorkspace(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/workspace`);
    return this.leads.prepareWorkspace(ctx, id);
  }

  /** "Hand over": the contact becomes admin and is invited; the operator leaves it. */
  @Post('leads/:id/handover')
  async handOver(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/handover`);
    return this.leads.handOver(ctx, id);
  }

  /** Every scheduled e-mail goes out now (one per lead). */
  @Post('leads/send-scheduled')
  async sendAllScheduled(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/leads/send-scheduled');
    return this.leads.sendAllScheduled(ctx);
  }

  /** The filled-in first e-mail to every e-mail lead that is ready for one. */
  @Post('leads/send-ready')
  async sendAllReady(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/leads/send-ready');
    return this.leads.writeAllReady(ctx, true);
  }

  /** The filled-in first e-mail to every ready e-mail lead, scheduled for the next send slot. */
  @Post('leads/schedule-ready')
  async scheduleAllReady(@Ctx() ctx: RequestContext) {
    await this.owner.assertOwner(ctx, '/owner/leads/schedule-ready');
    return this.leads.writeAllReady(ctx, false);
  }

  @Get('leads/:id')
  async getLead(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}`);
    return this.leads.get(ctx, id);
  }

  /** The lead's replies with their text, from the mailbox (read when asked, never stored). */
  @Get('leads/:id/replies')
  async leadReplies(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/replies`);
    return this.leads.replies(ctx, id);
  }

  @Patch('leads/:id')
  async updateLead(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(leadUpdateSchema)) body: LeadInput,
  ) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}`);
    return this.leads.update(ctx, id, body);
  }

  @Delete('leads/:id')
  @HttpCode(204)
  async deleteLead(@Ctx() ctx: RequestContext, @Param('id', IdPipe) id: string) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}`);
    await this.leads.remove(ctx, id);
  }

  /** The template for this lead, filled in, to start writing from. */
  @Get('leads/:id/draft')
  async draft(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Query('kind', new ZodPipe(kindSchema)) kind: LeadMessageKind,
  ) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/draft`);
    return this.leads.draft(ctx, id, kind);
  }

  /** Schedule one e-mail; it goes out at the next send slot (Tue–Thu, 8 am Zurich). */
  @Post('leads/:id/messages')
  async schedule(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Body(new ZodPipe(leadMessageSchema))
    body: { kind: LeadMessageKind; subject: string; body: string; sendNow?: boolean },
  ) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/messages`);
    return this.leads.schedule(ctx, id, body);
  }

  /** Send a scheduled e-mail right away instead of waiting for its slot. */
  @Post('leads/:id/messages/:messageId/send')
  async sendNow(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Param('messageId', IdPipe) messageId: string,
  ) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/messages/${messageId}/send`);
    return this.leads.sendNow(ctx, id, messageId);
  }

  @Delete('leads/:id/messages/:messageId')
  @HttpCode(204)
  async cancel(
    @Ctx() ctx: RequestContext,
    @Param('id', IdPipe) id: string,
    @Param('messageId', IdPipe) messageId: string,
  ) {
    await this.owner.assertOwner(ctx, `/owner/leads/${id}/messages/${messageId}`);
    await this.leads.cancel(ctx, id, messageId);
  }
}
