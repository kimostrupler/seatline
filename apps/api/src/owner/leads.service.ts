import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MailLanguage } from '@seatline/shared';
import {
  cleanLead,
  draftMessage,
  followUpDue,
  isNoAnswer,
  isNo,
  isSendingHour,
  leadScore,
  LEAD_RETENTION_MONTHS,
  messageProblem,
  SEND_ALL_MAX,
  nextSendSlot,
  nextStep,
  ownLinesRemoved,
  videoLink,
  type LeadChannel,
  type LeadInput,
  type LeadLanguage,
  type LeadMessageKind,
  type LeadStatus,
} from '@seatline/shared/dist/outreach';
import { OPERATOR } from '@seatline/shared/dist/legal';
import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../auth/request-context';
import { audit } from '../common/audit';
import { loadConfig } from '../config';
import { BIG_BATCH, TenantDb, type Tx } from '../db/tenant-db.service';
import { InboxService, withoutQuote, type Reply } from '../mail/inbox.service';
import { MailService } from '../mail/mail.service';
import { outreachReminderMail } from '../mail/texts';

type System = { tenantId: string; actorId: null };
/** Statuses where we're still waiting for the lead (a reply ends it, scheduled mails stop). */
const WAITING: LeadStatus[] = ['sent', 'followed_up'];
/** Mailbox providers: there only the exact address counts as a reply, not the whole domain. */
const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'yahoo.com',
  'bluewin.ch',
  'gmx.ch',
  'gmx.net',
  'gmx.de',
  'sunrise.ch',
  'hispeed.ch',
  'protonmail.com',
  'proton.me',
]);

const escape = (s: string) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * The HTML version of an outreach e-mail: the same words, links clickable, and the promo video's
 * link shown as its picture (a 6-second preview with a play button) — a plain file on
 * seatline.ch, the same for everyone, so nothing tracks who opened it.
 */
export function outreachHtml(body: string, language: LeadLanguage): string {
  const video = videoLink(language);
  const picture = `<a href="${escape(video)}"><img src="https://seatline.ch/site-video/email/seatline-video.gif" width="480" alt="Seatline video" style="display:block;width:480px;max-width:100%;height:auto;border:0;border-radius:8px;margin:4px 0"></a>`;
  const paragraphs = body.split(/\n{2,}/).map((p) =>
    p
      .split('\n')
      .map((line) =>
        line.trim() === video
          ? `${picture}<a href="${escape(video)}">${escape(video.replace(/^https:\/\/|\?.*$/g, ''))}</a>`
          : escape(line).replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`),
      )
      .join('<br>'),
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs
    .map((p) => `<p style="margin:0 0 14px">${p}</p>`)
    .join('')}</div>`;
}

/** The part of an address that counts for replies: the domain, or the address at a mail provider. */
export function replyKey(email: string): { domain: string; exact: string | null } {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return { domain, exact: FREE_MAIL.has(domain) ? email.toLowerCase() : null };
}

/** Same company, however it's written ("Muster AG" = "muster ag "). */
const key = (company: string) => company.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The operator's outreach (Leads page): possible customers, one personal e-mail at a time.
 * Scheduled e-mails go out with the morning job (Tuesday–Thursday, 8 am Zurich); a reply from
 * the lead's company stops everything still scheduled.
 */
@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);
  private readonly config = loadConfig();

  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
    private readonly inbox: InboxService,
  ) {}

  async list(ctx: RequestContext, now = new Date()) {
    const leads = await this.db.run(ctx.tenantId, (tx) =>
      tx.lead.findMany({
        where: { tenantId: ctx.tenantId },
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            where: { sentAt: null, canceledAt: null },
            select: { scheduledFor: true, kind: true },
          },
        },
      }),
    );
    return {
      mailReady: this.mail.configured,
      repliesChecked: this.inbox.configured,
      leads: leads.map(({ messages, ...lead }) => ({
        ...lead,
        ...leadScore(lead),
        scheduledFor: messages[0]?.scheduledFor ?? null,
        followUpDue: lead.firstSentAt ? followUpDue(lead.firstSentAt) : null,
        nextStep: nextStep(
          {
            status: lead.status as LeadStatus,
            firstSentAt: lead.firstSentAt,
            followUpSentAt: lead.followUpSentAt,
            scheduled: messages.length > 0,
            researched: !!lead.whyNow && (lead.channel !== 'email' || !!lead.contactEmail),
          },
          now,
        ),
      })),
    };
  }

  async get(ctx: RequestContext, id: string) {
    const lead = await this.db.run(ctx.tenantId, (tx) =>
      tx.lead.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      }),
    );
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async create(ctx: RequestContext, input: LeadInput & { company: string }) {
    const data = cleanLead(input);
    return this.db.run(ctx.tenantId, async (tx) => {
      const lead = await tx.lead.create({ data: { ...data, tenantId: ctx.tenantId } });
      await audit(tx, ctx, {
        action: 'owner.lead.create',
        entityType: 'lead',
        entityId: lead.id,
        after: { company: lead.company },
      });
      return lead;
    });
  }

  /**
   * Adds researched leads in one go. A company or e-mail address that's already a lead (in any
   * status, "no" included) is skipped, so nobody is written to twice.
   */
  /**
   * Researched leads from a file. A company or address that is already a lead isn't added again;
   * the file may only fill in what that lead still lacks: its size, and tags it doesn't have yet.
   */
  async import(ctx: RequestContext, input: Array<LeadInput & { company: string }>) {
    return this.db.run(
      ctx.tenantId,
      async (tx) => {
        const existing = await tx.lead.findMany({
          where: { tenantId: ctx.tenantId },
          select: { id: true, company: true, contactEmail: true, employees: true, tags: true },
        });
        const byKey = new Map(
          existing.flatMap((l) =>
            [key(l.company), l.contactEmail ?? ''].filter(Boolean).map((k) => [k, l] as const),
          ),
        );
        const inFile = new Set<string>();
        const added: string[] = [];
        const updated: string[] = [];
        const skipped: string[] = [];
        for (const row of input) {
          const data = cleanLead(row);
          const keys = [key(data.company), data.contactEmail ?? ''].filter(Boolean);
          if (keys.some((k) => inFile.has(k))) {
            skipped.push(data.company); // twice in the same file
            continue;
          }
          keys.forEach((k) => inFile.add(k));
          const old = keys.map((k) => byKey.get(k)).find(Boolean);
          if (old) {
            const fill: { employees?: number; tags?: string[] } = {};
            if (old.employees == null && data.employees != null) fill.employees = data.employees;
            const tags = [...new Set([...old.tags, ...(data.tags ?? [])])];
            if (tags.length > old.tags.length) fill.tags = tags;
            if (!Object.keys(fill).length) {
              skipped.push(data.company);
              continue;
            }
            await tx.lead.update({ where: { id: old.id }, data: fill });
            await audit(tx, ctx, {
              action: 'owner.lead.update',
              entityType: 'lead',
              entityId: old.id,
              before: { company: old.company, employees: old.employees, tags: old.tags },
              after: { company: old.company, ...fill, imported: true },
            });
            updated.push(old.company);
            continue;
          }
          const lead = await tx.lead.create({
            data: { ...data, status: 'research', tenantId: ctx.tenantId },
          });
          await audit(tx, ctx, {
            action: 'owner.lead.create',
            entityType: 'lead',
            entityId: lead.id,
            after: { company: lead.company, imported: true },
          });
          added.push(lead.company);
        }
        return { added: added.length, updated, skipped };
      },
      BIG_BATCH,
    );
  }

  async update(ctx: RequestContext, id: string, input: LeadInput) {
    const data = cleanLead(input);
    if (data.company === null) throw new BadRequestException('The company is required');
    return this.db.run(ctx.tenantId, async (tx) => {
      const before = await this.find(tx, ctx.tenantId, id);
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...data,
          company: data.company ?? undefined,
          // set by hand (contact form, LinkedIn): the dates the follow-up and "no answer" use
          ...(data.status === 'sent' && !before.firstSentAt ? { firstSentAt: new Date() } : {}),
          ...(data.status === 'followed_up' && !before.followUpSentAt
            ? { followUpSentAt: new Date() }
            : {}),
          ...(data.status === 'replied' && !before.repliedAt ? { repliedAt: new Date() } : {}),
        },
      });
      if (data.status && !['research', 'ready', ...WAITING].includes(data.status))
        await this.cancelScheduled(tx, ctx.tenantId, id);
      await audit(tx, ctx, {
        action: 'owner.lead.update',
        entityType: 'lead',
        entityId: id,
        before: { company: before.company, status: before.status },
        after: { company: lead.company, status: lead.status },
      });
      return lead;
    });
  }

  async remove(ctx: RequestContext | System, id: string) {
    await this.db.run(ctx.tenantId, async (tx) => {
      const lead = await this.find(tx, ctx.tenantId, id);
      await tx.lead.delete({ where: { id } });
      await audit(tx, ctx, {
        action: 'owner.lead.delete',
        entityType: 'lead',
        entityId: id,
        before: { company: lead.company },
      });
    });
  }

  /** Schedule one e-mail to one lead; it goes out at the next send slot, or now (`sendNow`). */
  async schedule(
    ctx: RequestContext,
    id: string,
    message: { kind: LeadMessageKind; subject: string; body: string; sendNow?: boolean },
    now = new Date(),
  ) {
    const scheduled = await this.db.run(ctx.tenantId, async (tx) => {
      const lead = await tx.lead.findFirst({
        where: { id, tenantId: ctx.tenantId },
        include: { messages: { where: { canceledAt: null } } },
      });
      if (!lead) throw new NotFoundException('Lead not found');
      const problem = messageProblem(
        { ...lead, channel: lead.channel as LeadChannel },
        message.body,
      );
      if (problem) throw new BadRequestException({ message: 'Not ready to send', code: problem });
      const first = lead.messages.find((m) => m.kind === 'first');
      if (lead.messages.some((m) => !m.sentAt))
        throw new ConflictException({
          message: 'An e-mail is already scheduled',
          code: 'scheduled',
        });
      if (message.kind === 'first' && first)
        throw new ConflictException({ message: 'The first e-mail is already sent', code: 'sent' });
      if (message.kind === 'follow_up' && (!first?.sentAt || lead.followUpSentAt))
        throw new ConflictException({ message: 'No follow-up possible', code: 'no_follow_up' });
      if (message.kind === 'ask_why') {
        // one short thank-you after a "no", never more
        if (
          lead.status !== 'no' ||
          !first?.sentAt ||
          lead.messages.some((m) => m.kind === 'ask_why')
        )
          throw new ConflictException({ message: 'Only once, after a “no”', code: 'no_ask_why' });
      } else if (['replied', 'meeting', 'customer', 'no', 'no_answer'].includes(lead.status))
        throw new ConflictException({ message: 'This lead is closed', code: 'closed' });
      const scheduled = await tx.leadMessage.create({
        data: {
          tenantId: ctx.tenantId,
          leadId: id,
          kind: message.kind,
          subject: message.subject,
          body: message.body,
          toAddress: lead.contactEmail!,
          scheduledFor: message.sendNow ? now : nextSendSlot(now),
          messageId: `<${randomUUID()}@${this.mail.fromAddress.split('@')[1] ?? 'seatline.ch'}>`,
        },
      });
      if (lead.status === 'research')
        await tx.lead.update({ where: { id }, data: { status: 'ready' } });
      await audit(tx, ctx, {
        action: 'owner.lead.schedule',
        entityType: 'lead',
        entityId: id,
        after: { company: lead.company, kind: message.kind, scheduledFor: scheduled.scheduledFor },
      });
      return scheduled;
    });
    if (!message.sendNow) return scheduled;
    try {
      return await this.sendNow(ctx, id, scheduled.id, now);
    } catch (error) {
      // not sent: it waits for the next send slot instead (and the page says why)
      await this.db.run(ctx.tenantId, (tx) =>
        tx.leadMessage.update({
          where: { id: scheduled.id },
          data: { scheduledFor: nextSendSlot(now) },
        }),
      );
      throw error;
    }
  }

  /** Send a scheduled e-mail right away (the operator clicked "Send now"). */
  async sendNow(ctx: RequestContext, id: string, messageId: string, now = new Date()) {
    const message = await this.db.run(ctx.tenantId, (tx) =>
      tx.leadMessage.findFirst({
        where: {
          id: messageId,
          leadId: id,
          tenantId: ctx.tenantId,
          sentAt: null,
          canceledAt: null,
        },
        include: { lead: { include: { messages: { where: { kind: 'first' } } } } },
      }),
    );
    if (!message) throw new ConflictException({ message: 'Already sent', code: 'sent' });
    if (!this.mail.configured)
      throw new ServiceUnavailableException({ message: 'E-mail is not set up', code: 'mail_off' });
    await this.deliver(ctx, message, now, true);
    return { ...message, lead: undefined, sentAt: now };
  }

  /**
   * "Send all scheduled": every e-mail already written and scheduled goes out now instead of at
   * its slot. Still one e-mail per lead; ones that fail stay scheduled.
   */
  async sendAllScheduled(ctx: RequestContext, now = new Date()) {
    this.assertMail();
    const waiting = await this.db.run(ctx.tenantId, (tx) =>
      tx.leadMessage.findMany({
        where: { tenantId: ctx.tenantId, sentAt: null, canceledAt: null },
        orderBy: { scheduledFor: 'asc' },
        take: SEND_ALL_MAX,
        include: { lead: { include: { messages: { where: { kind: 'first' } } } } },
      }),
    );
    let done = 0;
    const failed: string[] = [];
    for (const message of waiting)
      if (await this.deliver(ctx, message, now)) done++;
      else failed.push(message.lead.company);
    return { done, failed };
  }

  /**
   * "Write and send to all ready" (or schedule, `sendNow` false): the filled-in template for
   * every e-mail lead still waiting for its first e-mail. Leads whose template isn't complete
   * (a placeholder, no reason) are skipped, so nothing half-written goes out.
   */
  async writeAllReady(ctx: RequestContext, sendNow: boolean, now = new Date()) {
    if (sendNow) this.assertMail();
    const { leads } = await this.list(ctx, now);
    const ready = leads
      .filter((l) => l.nextStep === 'write_first' && l.channel === 'email')
      // sending waits on SMTP for each one; scheduling is only a database row
      .slice(0, sendNow ? SEND_ALL_MAX : undefined);
    let done = 0;
    const failed: string[] = [];
    for (const lead of ready)
      try {
        const draft = await this.draft(ctx, lead.id, 'first');
        await this.schedule(ctx, lead.id, { kind: 'first', ...draft, sendNow }, now);
        done++;
      } catch {
        failed.push(lead.company);
      }
    return { done, failed };
  }

  private assertMail() {
    if (!this.mail.configured)
      throw new ServiceUnavailableException({ message: 'E-mail is not set up', code: 'mail_off' });
  }

  async cancel(ctx: RequestContext, id: string, messageId: string) {
    await this.db.run(ctx.tenantId, async (tx) => {
      const lead = await this.find(tx, ctx.tenantId, id);
      const { count } = await tx.leadMessage.updateMany({
        where: { id: messageId, leadId: id, sentAt: null, canceledAt: null },
        data: { canceledAt: new Date() },
      });
      if (!count) throw new ConflictException({ message: 'Already sent', code: 'sent' });
      await audit(tx, ctx, {
        action: 'owner.lead.cancel',
        entityType: 'lead',
        entityId: id,
        after: { company: lead.company },
      });
    });
  }

  /** A draft to start from (the template, filled in with what the lead has). */
  async draft(ctx: RequestContext, id: string, kind: LeadMessageKind) {
    const lead = await this.get(ctx, id);
    const first = lead.messages.find((m) => m.kind === 'first' && m.sentAt);
    return draftMessage(kind, { ...lead, language: lead.language as LeadLanguage }, first?.subject);
  }

  /**
   * The morning job (and the night run, which only looks for replies): replies first (they
   * stop what's scheduled), then due e-mails (only in the morning, never at night), reminders
   * for follow-ups, "no answer", and deleting old "no"/"no answer" leads.
   */
  async runOutreach(tenantId: string, now = new Date()) {
    const system: System = { tenantId, actorId: null };
    const { replied, declined, autoReplies } = await this.checkReplies(system);
    const morning = isSendingHour(now);
    const sent = morning ? await this.sendDue(system, now) : 0;
    const reminded = morning ? await this.remindFollowUps(system, now) : 0;
    const closed = await this.db.run(tenantId, async (tx) => {
      const waiting = await tx.lead.findMany({ where: { tenantId, status: 'followed_up' } });
      const old = waiting.filter((l) =>
        isNoAnswer({ status: 'followed_up', followUpSentAt: l.followUpSentAt }, now),
      );
      for (const lead of old) {
        await tx.lead.update({ where: { id: lead.id }, data: { status: 'no_answer' } });
        await audit(tx, system, {
          action: 'owner.lead.update',
          entityType: 'lead',
          entityId: lead.id,
          before: { company: lead.company, status: lead.status },
          after: { company: lead.company, status: 'no_answer' },
        });
      }
      return old.length;
    });
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - LEAD_RETENTION_MONTHS);
    const expired = await this.db.run(tenantId, (tx) =>
      tx.lead.findMany({
        where: { tenantId, status: { in: ['no', 'no_answer'] }, updatedAt: { lt: cutoff } },
        select: { id: true },
      }),
    );
    for (const lead of expired) await this.remove(system, lead.id);
    return { replied, declined, autoReplies, sent, reminded, closed, deleted: expired.length };
  }

  /**
   * The lead's replies and automatic answers with their text, read from the mailbox when the
   * lead is opened (never stored): answers to our e-mails, or anything from the contact.
   */
  async replies(ctx: RequestContext, id: string) {
    const lead = await this.get(ctx, id);
    if (!lead.contactEmail || !lead.firstSentAt || !this.inbox.configured) return [];
    const key = replyKey(lead.contactEmail);
    const ours = lead.messages.map((m) => m.messageId);
    let found;
    try {
      found = await this.inbox.messagesFrom(key.domain, lead.firstSentAt);
    } catch (error) {
      this.logger.warn(`Reading a lead's replies failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        message: 'The mailbox can’t be read just now',
        code: 'inbox_off',
      });
    }
    return found
      .filter(
        (m) =>
          m.answers.some((a) => ours.includes(a)) ||
          m.from === (key.exact ?? lead.contactEmail!.toLowerCase()),
      )
      .sort((x, y) => x.date.getTime() - y.date.getTime())
      .map((m) => ({
        from: m.from,
        date: m.date,
        subject: m.subject,
        auto: m.auto,
        text: withoutQuote(m.text).slice(0, 20_000),
      }));
  }

  private readonly lastCheck = new Map<string, number>();

  /**
   * The Leads page asks on opening (besides the two daily runs), so replies and out-of-office
   * answers show up without waiting for the morning. At most once a minute per workspace.
   */
  async checkRepliesNow(ctx: RequestContext, now = Date.now()) {
    if (now - (this.lastCheck.get(ctx.tenantId) ?? 0) < 60_000)
      return { replied: 0, declined: 0, autoReplies: 0 };
    this.lastCheck.set(ctx.tenantId, now);
    return this.checkReplies({ tenantId: ctx.tenantId, actorId: null });
  }

  /**
   * Replies and automatic answers since our e-mails went out. A person's reply closes the lead
   * ("replied", what's scheduled is cancelled); an automatic one (out-of-office…) is only noted
   * on the lead, so the follow-up still goes out.
   */
  private async checkReplies(
    system: System,
  ): Promise<{ replied: number; declined: number; autoReplies: number }> {
    const waiting = await this.db.run(system.tenantId, (tx) =>
      tx.lead.findMany({
        where: { tenantId: system.tenantId, status: { in: WAITING }, contactEmail: { not: null } },
      }),
    );
    const none = { replied: 0, declined: 0, autoReplies: 0 };
    if (!waiting.length || !this.inbox.configured) return none;
    const since = new Date(
      Math.min(...waiting.map((l) => (l.firstSentAt ?? new Date()).getTime())),
    );
    let replies;
    try {
      replies = await this.inbox.repliesFrom(
        [...new Set(waiting.map((l) => replyKey(l.contactEmail!).domain))],
        since,
      );
    } catch (error) {
      this.logger.warn(`Checking for outreach replies failed: ${(error as Error).message}`);
      return none;
    }
    const ours = await this.db.run(system.tenantId, (tx) =>
      tx.leadMessage.findMany({
        where: { tenantId: system.tenantId, leadId: { in: waiting.map((l) => l.id) } },
        select: { leadId: true, messageId: true, body: true },
      }),
    );
    let n = 0;
    let declined = 0;
    let autoReplies = 0;
    for (const lead of waiting) {
      const key = replyKey(lead.contactEmail!);
      const sent = ours.filter((m) => m.leadId === lead.id).map((m) => m.messageId);
      // an automatic answer to our e-mail, or from the contact: noted, newest first
      const auto = replies
        .filter(
          (r) =>
            lead.firstSentAt &&
            r.date >= lead.firstSentAt &&
            r.auto &&
            (r.answers.some((id) => sent.includes(id)) ||
              r.from === (key.exact ?? lead.contactEmail!.toLowerCase())),
        )
        .sort((x, y) => y.date.getTime() - x.date.getTime())[0];
      if (auto && (!lead.autoReplyAt || auto.date > lead.autoReplyAt)) {
        autoReplies++;
        await this.db.run(system.tenantId, async (tx) => {
          await tx.lead.update({
            where: { id: lead.id },
            data: { autoReplyAt: auto.date, autoReplySubject: auto.subject.slice(0, 300) || null },
          });
          await audit(tx, system, {
            action: 'owner.lead.auto_reply',
            entityType: 'lead',
            entityId: lead.id,
            after: { company: lead.company },
          });
        });
      }
      // a reply answers one of our e-mails (In-Reply-To / References), or comes from the contact
      // themselves and not from a machine. A colleague's out-of-office or a newsletter from
      // the same domain is neither, and must not cancel the follow-up.
      const reply = replies.find(
        (r) =>
          lead.firstSentAt &&
          r.date >= lead.firstSentAt &&
          !r.auto &&
          (r.answers.some((id) => sent.includes(id)) ||
            r.from === (key.exact ?? lead.contactEmail!.toLowerCase())),
      );
      if (!reply) continue;
      // a clear "no" in it moves the lead to "no" at once (read, never stored)
      const no = await this.saysNo(
        key.domain,
        reply,
        ours.filter((m) => m.leadId === lead.id).map((m) => m.body),
      );
      if (no) declined++;
      else n++;
      await this.db.run(system.tenantId, async (tx) => {
        await tx.lead.update({
          where: { id: lead.id },
          data: { status: no ? 'no' : 'replied', repliedAt: reply.date },
        });
        await this.cancelScheduled(tx, system.tenantId, lead.id);
        await audit(tx, system, {
          action: no ? 'owner.lead.declined' : 'owner.lead.replied',
          entityType: 'lead',
          entityId: lead.id,
          after: { company: lead.company },
        });
      });
    }
    return { replied: n, declined, autoReplies };
  }

  /** Whether the person's reply clearly says no (their own words, not our quoted e-mail). */
  private async saysNo(domain: string, reply: Reply, ours: string[]): Promise<boolean> {
    try {
      const found = (await this.inbox.messagesFrom(domain, reply.date)).find(
        (m) => m.from === reply.from && m.date.getTime() === reply.date.getTime(),
      );
      return !!found && isNo(ownLinesRemoved(withoutQuote(found.text), ours));
    } catch (error) {
      this.logger.warn(`Reading a reply's text failed: ${(error as Error).message}`);
      return false; // then it's a plain reply, to read by hand
    }
  }

  private async sendDue(system: System, now: Date): Promise<number> {
    if (!this.mail.configured) return 0;
    const due = await this.db.run(system.tenantId, (tx) =>
      tx.leadMessage.findMany({
        where: {
          tenantId: system.tenantId,
          sentAt: null,
          canceledAt: null,
          scheduledFor: { lte: now },
        },
        include: { lead: { include: { messages: { where: { kind: 'first' } } } } },
      }),
    );
    let n = 0;
    for (const message of due) if (await this.deliver(system, message, now)) n++;
    return n;
  }

  /** Send one e-mail, mark it sent and move the lead on. False (or the error) if it failed. */
  private async deliver(
    actor: RequestContext | System,
    message: Prisma.LeadMessageGetPayload<{
      include: { lead: { include: { messages: true } } };
    }>,
    now: Date,
    rethrow = false,
  ): Promise<boolean> {
    const lead = message.lead;
    // claim it first: the morning job and a "Send now" click (or a retry after a lost DB
    // connection) must never both send the same e-mail
    const { count } = await this.db.run(actor.tenantId, (tx) =>
      tx.leadMessage.updateMany({
        where: { id: message.id, sentAt: null, canceledAt: null },
        data: { sentAt: now },
      }),
    );
    if (count === 0) return false;
    // the follow-up and the thank-you after a "no" answer the first e-mail
    const replyTo = message.kind === 'first' ? undefined : lead.messages[0]?.messageId;
    const mail = {
      to: message.toAddress,
      subject: message.subject,
      text: message.body,
      html: outreachHtml(message.body, lead.language as LeadLanguage),
      fromName: `${OPERATOR.name} · Seatline`,
      messageId: message.messageId,
      inReplyTo: replyTo,
    };
    try {
      await this.mail.send(mail);
    } catch (error) {
      // not sent: give the claim back so the next morning run (or the operator) tries again
      await this.db.run(actor.tenantId, (tx) =>
        tx.leadMessage.update({ where: { id: message.id }, data: { sentAt: null } }),
      );
      if (rethrow) throw error;
      return false; // MailService logged it
    }
    await this.inbox.fileSent({ ...mail, from: `${mail.fromName} <${this.mail.fromAddress}>` });
    await this.db.run(actor.tenantId, async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data:
          message.kind === 'first'
            ? { status: 'sent', firstSentAt: now }
            : message.kind === 'follow_up'
              ? { status: 'followed_up', followUpSentAt: now }
              : {}, // ask_why: the lead stays "no"
      });
      await audit(tx, actor, {
        action: 'owner.lead.sent',
        entityType: 'lead',
        entityId: lead.id,
        after: { company: lead.company, kind: message.kind },
      });
    });
    return true;
  }

  /** One e-mail to the operator listing the follow-ups that are due (none scheduled yet). */
  private async remindFollowUps(system: System, now: Date): Promise<number> {
    if (!this.mail.configured) return 0;
    const { due, operators, language } = await this.db.run(system.tenantId, async (tx) => ({
      due: await tx.lead.findMany({
        where: {
          tenantId: system.tenantId,
          status: 'sent',
          firstSentAt: { lte: new Date(now.getTime() - 7 * 864e5) },
          messages: { none: { kind: 'follow_up', canceledAt: null } },
        },
        select: { id: true, company: true },
      }),
      operators: await tx.person.findMany({
        where: { tenantId: system.tenantId, appRole: 'admin', active: true },
        select: { email: true },
      }),
      language: (
        await tx.tenant.findUniqueOrThrow({
          where: { id: system.tenantId },
          select: { notifyLanguage: true },
        })
      ).notifyLanguage as MailLanguage,
    }));
    const to = operators
      .map((p) => p.email)
      .filter((e) => this.config.OWNER_EMAILS.includes(e.toLowerCase()));
    if (!due.length || !to.length) return 0;
    const links = due.map((l) => ({
      company: l.company,
      link: `${this.mail.appUrl}/owner/leads?lead=${l.id}`,
    }));
    for (const address of to) await this.mail.send(outreachReminderMail(address, links, language));
    return due.length;
  }

  private async cancelScheduled(tx: Tx, tenantId: string, leadId: string) {
    await tx.leadMessage.updateMany({
      where: { tenantId, leadId, sentAt: null, canceledAt: null },
      data: { canceledAt: new Date() },
    });
  }

  private async find(tx: Tx, tenantId: string, id: string) {
    const lead = await tx.lead.findFirst({ where: { id, tenantId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }
}
