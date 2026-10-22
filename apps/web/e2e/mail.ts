import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/** The e2e API writes e-mails here instead of sending them (MAIL_OUTBOX). */
export const MAIL_OUTBOX = path.join(tmpdir(), 'seatline-e2e-mail');

export function clearMails() {
  rmSync(MAIL_OUTBOX, { recursive: true, force: true });
}

export function mailsTo(to: string): Array<{ to: string; subject: string; text: string }> {
  let files: string[] = [];
  try {
    files = readdirSync(MAIL_OUTBOX).sort();
  } catch {
    return [];
  }
  return files
    .map((f) => JSON.parse(readFileSync(path.join(MAIL_OUTBOX, f), 'utf8')))
    .filter((m) => m.to === to);
}

/** The link in the last e-mail to `to` (sign-in link or invitation). */
export function lastLink(to: string): string | undefined {
  return /https?:\/\/\S+/.exec(mailsTo(to).at(-1)?.text ?? '')?.[0];
}
