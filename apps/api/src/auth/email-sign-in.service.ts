import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { MailLanguage } from '@seatline/shared';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { TenantDb } from '../db/tenant-db.service';
import { MailService } from '../mail/mail.service';
import { signInMail } from '../mail/texts';

export const LINK_MINUTES = 15;
/** links per address per 15 minutes */
export const MAX_RECENT_LINKS = 3;

/** wrong codes before a sign-in e-mail's code stops working (1 in 200 000 to guess it) */
export const MAX_FAILED_CODES = 5;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
/** the code is only unique together with its address */
export const hashCode = (email: string, code: string) =>
  hashToken(`code:${email.toLowerCase()}:${code}`);

/**
 * One-time sign-in links: 32 random bytes in the link, only their hash in the database;
 * a link works once, for 15 minutes. Any address gets a link (the first person of a new
 * company signs up this way), so nobody learns from this whether an address has an account.
 * The same e-mail carries a 6-digit code for typing in (an iPhone home-screen app has its own
 * sign-in, but links open in Safari): same row, so link or code, it works once.
 */
@Injectable()
export class EmailSignInService {
  private readonly logger = new Logger(EmailSignInService.name);

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
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const ok = await this.db.createEmailSignIn(
      email,
      hashToken(token),
      hashCode(email, code),
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
    await this.mail.send(signInMail(email, link, code, language));
    // no address in the log (personal data); the domain helps to spot delivery problems
    this.logger.log(`Sign-in link sent (to an address at ${email.split('@')[1] ?? '?'})`);
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

  /** The same, with the 6-digit code from the e-mail instead of the link. */
  async verifyCode(email: string, code: string) {
    const found = await this.db.useEmailSignInCode(email, hashCode(email, code), MAX_FAILED_CODES);
    if (!found)
      throw new BadRequestException({
        message: 'This code is wrong, expired or was already used',
        code: 'code_invalid',
      });
    return { email: found };
  }
}
