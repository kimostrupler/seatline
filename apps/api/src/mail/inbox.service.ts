import { Injectable, Logger } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImapFlow, type MessageStructureObject } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer';
import { loadConfig } from '../config';
import type { Mail } from './mail.service';

/**
 * A reply that came in: who wrote (the address only), when, which e-mails it answers
 * (In-Reply-To + References Message-IDs), its subject and whether a machine sent it
 * (out-of-office, bounces). Nothing else is read.
 */
export interface Reply {
  from: string;
  date: Date;
  answers: string[];
  auto: boolean;
  subject: string;
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

/** Subjects mail programs give automatic answers, in English, German and French. */
const AUTO_SUBJECT =
  /^\s*(automatic reply|auto[- ]?reply|autoreply|automatische antwort|abwesenheit|out of (the )?office|r[ée]ponse automatique|absence)/i;

/**
 * Sent by a machine, not a person: an Auto-Submitted header (RFC 3834), the older Precedence /
 * X-Autoreply / X-Autorespond headers, or an out-of-office subject (some programs set no header).
 */
export function isAutomatic(raw: string, subject = ''): boolean {
  return (
    isAutoSubmitted(headerValue(raw, 'Auto-Submitted')) ||
    /^(auto_reply|bulk|junk|list)$/i.test(headerValue(raw, 'Precedence') ?? '') ||
    !!headerValue(raw, 'X-Autoreply') ||
    !!headerValue(raw, 'X-Autorespond') ||
    AUTO_SUBJECT.test(subject)
  );
}

/** A message with its readable text (fetched only to show it, never stored). */
export interface InboxMessage extends Reply {
  text: string;
}

/** The readable part of a message: text/plain, else text/html; never an attachment. */
export function textPart(node?: MessageStructureObject): { part: string; html: boolean } | null {
  if (!node) return null;
  if (node.childNodes) {
    const found = node.childNodes.map(textPart).filter((p) => p !== null);
    return found.find((p) => !p.html) ?? found[0] ?? null;
  }
  if (node.disposition === 'attachment') return null;
  if (node.type === 'text/plain') return { part: node.part ?? '1', html: false };
  if (node.type === 'text/html') return { part: node.part ?? '1', html: true };
  return null;
}

/** Plain text from an e-mail's HTML (enough to read a reply; no markup survives). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Where the quoted earlier e-mail starts ("On … wrote:", "> …", Outlook's "From: …"). */
const QUOTE_START =
  /^\s*(>|-{2,}\s*(original message|ursprüngliche nachricht|message d.origine)|on .+ wrote:|am .+ schrieb.*:|le .+ a écrit\s*:|(from|von|de)\s?:\s.*@)/i;

/** The reply without the quoted e-mail below it (the whole text if nothing else is left). */
export function withoutQuote(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const at = lines.findIndex((l) => QUOTE_START.test(l));
  const own = (at < 0 ? lines : lines.slice(0, at)).join('\n').trim();
  return own || text.trim();
}

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
    if (this.config.MAIL_INBOX)
      return (await this.inboxFiles()).filter(
        (m) => m.date >= since && domains.includes(m.from.split('@')[1] ?? ''),
      );
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const replies: Reply[] = [];
        for (const domain of domains) {
          const uids = await client.search({ since, from: `@${domain}` }, { uid: true });
          if (!uids || !uids.length) continue;
          const want = {
            envelope: true,
            headers: ['references', 'auto-submitted', 'precedence', 'x-autoreply', 'x-autorespond'],
          };
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
              auto: isAutomatic(raw, m.envelope?.subject),
              subject: m.envelope?.subject ?? '',
            });
          }
        }
        return replies;
      } finally {
        lock.release();
      }
    });
  }

  /** The test inbox: one JSON file per message. */
  private async inboxFiles(): Promise<InboxMessage[]> {
    const dir = this.config.MAIL_INBOX!;
    const files = await readdir(dir).catch(() => []);
    return Promise.all(
      files.map(async (f) => {
        const m = JSON.parse(await readFile(join(dir, f), 'utf8')) as {
          from: string;
          date: string;
          inReplyTo?: string;
          autoSubmitted?: string;
          subject?: string;
          text?: string;
        };
        return {
          from: m.from.toLowerCase(),
          date: new Date(m.date),
          answers: messageIds(m.inReplyTo),
          auto: isAutomatic(m.autoSubmitted ? `Auto-Submitted: ${m.autoSubmitted}` : '', m.subject),
          subject: m.subject ?? '',
          text: m.text ?? '',
        };
      }),
    );
  }

  /**
   * Messages from one domain since a date, with their text, to show a lead's replies. Read from
   * the mailbox each time it's asked and never stored.
   */
  async messagesFrom(domain: string, since: Date): Promise<InboxMessage[]> {
    if (!this.configured) return [];
    if (this.config.MAIL_INBOX)
      return (await this.inboxFiles()).filter(
        (m) => m.date >= since && m.from.split('@')[1] === domain,
      );
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ since, from: `@${domain}` }, { uid: true });
        if (!uids || !uids.length) return [];
        const found: Array<Reply & { uid: number; part: ReturnType<typeof textPart> }> = [];
        const want = {
          envelope: true,
          bodyStructure: true,
          headers: ['references', 'auto-submitted', 'precedence', 'x-autoreply', 'x-autorespond'],
        };
        for await (const m of client.fetch(uids, want, { uid: true })) {
          const from = m.envelope?.from?.[0]?.address?.toLowerCase();
          if (!from || from.split('@')[1] !== domain) continue;
          const raw = m.headers?.toString() ?? '';
          found.push({
            uid: m.uid,
            from,
            date: m.envelope?.date ?? new Date(),
            answers: [
              ...messageIds(m.envelope?.inReplyTo),
              ...messageIds(headerValue(raw, 'References')),
            ],
            auto: isAutomatic(raw, m.envelope?.subject),
            subject: m.envelope?.subject ?? '',
            part: textPart(m.bodyStructure),
          });
        }
        // the texts after the fetch (no other command may run while it streams)
        const messages: InboxMessage[] = [];
        for (const { uid, part, ...m } of found) {
          let text = '';
          if (part) {
            const { content } = await client.download(String(uid), part.part, {
              uid: true,
              maxBytes: 200_000,
            });
            const chunks: Buffer[] = [];
            for await (const c of content) chunks.push(c as Buffer);
            const body = Buffer.concat(chunks).toString('utf8');
            text = part.html ? htmlToText(body) : body;
          }
          messages.push({ ...m, text });
        }
        return messages;
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
