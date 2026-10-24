import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImapFlow } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer';
import { loadConfig } from '../config';
import type { Mail } from './mail.service';

/**
 * A reply that came in: who wrote (the address only), when, which e-mails it answers
 * (In-Reply-To + References Message-IDs) and whether a machine sent it (Auto-Submitted:
 * out-of-office, bounces). Nothing else is read.
 */
export interface Reply {
  from: string;
  date: Date;
  answers: string[];
  auto: boolean;
}

/** Message-IDs from an In-Reply-To or References header value. */
export const messageIds = (header: string | undefined | null): string[] =>
  header?.match(/<[^<>\s]+>/g) ?? [];

/** The value of one header in a raw header block (the first occurrence). */
export function headerValue(raw: string, name: string): string | undefined {
  const m = new RegExp(`^${name}:[ \\t]*((?:.*(?:\\r?\\n[ \\t].*)*))`, 'im').exec(raw);
  return m?.[1]?.replace(/\r?\n[ \t]+/g, ' ').trim();
}

/** "Auto-Submitted: no" is a person; anything else there (auto-replied, auto-generated) isn't. */
export const isAutoSubmitted = (value: string | undefined) =>
  !!value && !/^no(\s|;|$)/i.test(value.trim());

/**
 * The hello@ mailbox over IMAP, for outreach only: files each sent outreach e-mail in the Sent
 * folder (so the thread is complete in the mail app), and finds replies from a lead's domain.
 * Reads envelopes only (sender, date), never message bodies. Tests use MAIL_INBOX files.
 */
@Injectable()
export class InboxService {
  private readonly config = loadConfig();
  private readonly logger = new Logger(InboxService.name);

  get configured(): boolean {
    return !!this.config.MAIL_INBOX || (!!this.config.IMAP_HOST && !!this.config.SMTP_USER);
  }

  private async withClient<T>(fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const client = new ImapFlow({
      host: this.config.IMAP_HOST!,
      port: this.config.IMAP_PORT,
      secure: true,
      auth: { user: this.config.SMTP_USER!, pass: this.config.SMTP_PASSWORD ?? '' },
      logger: false,
    });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Senders that wrote since `since` from one of these domains (example.ch). */
  async repliesFrom(domains: string[], since: Date): Promise<Reply[]> {
    if (!domains.length || !this.configured) return [];
    if (this.config.MAIL_INBOX) {
      const files = await readdir(this.config.MAIL_INBOX).catch(() => []);
      const all = await Promise.all(
        files.map(
          async (f) =>
            JSON.parse(await readFile(join(this.config.MAIL_INBOX!, f), 'utf8')) as {
              from: string;
              date: string;
              inReplyTo?: string;
              autoSubmitted?: string;
            },
        ),
      );
      return all
        .map((m) => ({
          from: m.from.toLowerCase(),
          date: new Date(m.date),
          answers: messageIds(m.inReplyTo),
          auto: isAutoSubmitted(m.autoSubmitted),
        }))
        .filter((m) => m.date >= since && domains.includes(m.from.split('@')[1] ?? ''));
    }
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const replies: Reply[] = [];
        for (const domain of domains) {
          const uids = await client.search({ since, from: `@${domain}` }, { uid: true });
          if (!uids || !uids.length) continue;
          const want = { envelope: true, headers: ['references', 'auto-submitted'] };
          for await (const m of client.fetch(uids, want, { uid: true })) {
            const from = m.envelope?.from?.[0]?.address?.toLowerCase();
            // IMAP's FROM search matches anywhere in the header: check the domain exactly
            if (!from || from.split('@')[1] !== domain) continue;
            const raw = m.headers?.toString() ?? '';
            replies.push({
              from,
              date: m.envelope?.date ?? new Date(),
              answers: [
                ...messageIds(m.envelope?.inReplyTo),
                ...messageIds(headerValue(raw, 'References')),
              ],
              auto: isAutoSubmitted(headerValue(raw, 'Auto-Submitted')),
            });
          }
        }
        return replies;
      } finally {
        lock.release();
      }
    });
  }

  /** Keep a copy of a sent e-mail in the mailbox's Sent folder. Never fails the sending. */
  async fileSent(mail: Mail & { from: string }): Promise<void> {
    if (!this.config.IMAP_HOST || this.config.MAIL_INBOX || this.config.MAIL_OUTBOX) return;
    try {
      const raw = await new MailComposer({ ...mail, references: mail.inReplyTo }).compile().build();
      await this.withClient(async (client) => {
        const sent = (await client.list()).find((box) => box.specialUse === '\\Sent');
        await client.append(sent?.path ?? 'Sent', raw, ['\\Seen']);
      });
    } catch (error) {
      this.logger.warn(`Filing an outreach e-mail in Sent failed: ${(error as Error).message}`);
    }
  }
}
