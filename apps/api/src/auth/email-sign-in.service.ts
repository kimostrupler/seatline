import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { MailLanguage } from '@seatline/shared';
import { createHash, randomBytes } from 'node:crypto';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from '../mail/mail.service';
import { signInMail } from '../mail/texts';

export const LINK_MINUTES = 15;
/** links per address per 15 minutes */
export const MAX_RECENT_LINKS = 3;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * One-time sign-in links: 32 random bytes in the link, only their hash in the database;
 * a link works once, for 15 minutes. Any address gets a link (the first person of a new
 * company signs up this way), so nobody learns from this whether an address has an account.
 */
@Injectable()
export class EmailSignInService {
  constructor(
    private readonly db: TenantDb,
    private readonly mail: MailService,
  ) {}

  get enabled() {
    return this.mail.configured;
  }

  async start(email: string, language: MailLanguage) {
    if (!this.mail.configured)
      throw new HttpException('Sign-in by e-mail is not available', HttpStatus.NOT_FOUND);
    const token = randomBytes(32).toString('base64url');
    const ok = await this.db.createEmailSignIn(
      email,
      hashToken(token),
      LINK_MINUTES,
      MAX_RECENT_LINKS,
    );
    if (!ok)
      throw new HttpException(
        {
          message: 'Too many sign-in links for this address. Please wait a few minutes.',
          code: 'too_many_links',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const link = `${this.mail.appUrl}/auth/email?token=${token}`;
    await this.mail.send(signInMail(email, link, language));
    return { sent: true };
  }

  /** The address a link was sent to; the link can't be used again. */
  async verify(token: string) {
    const email = await this.db.useEmailSignIn(hashToken(token));
    if (!email)
      throw new BadRequestException({
        message: 'This sign-in link has expired or was already used',
        code: 'link_invalid',
      });
    return { email };
  }
}
