import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

/** E-mails the API "sent" (MAIL_OUTBOX), oldest first. */
export async function sentMails(): Promise<Array<{ to: string; subject: string; text: string }>> {
  const dir = process.env.MAIL_OUTBOX!;
  const files = (await readdir(dir).catch(() => [])).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'))));
}

export const clearMails = () => rm(process.env.MAIL_OUTBOX!, { recursive: true, force: true });

/** The token in the last sign-in link sent to `to`. */
export async function lastLinkToken(to: string) {
  const mail = (await sentMails()).filter((m) => m.to === to).at(-1);
  return mail && /\/auth\/email\?token=([A-Za-z0-9_-]+)/.exec(mail.text)?.[1];
}
