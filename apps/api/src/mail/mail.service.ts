import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTransport, type Transporter } from 'nodemailer';
import { loadConfig } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends e-mail through SMTP (Hostpoint, from hello@seatline.ch). Tests write each mail as a
 * JSON file into MAIL_OUTBOX instead. Without either, e-mail features are off.
 */
@Injectable()
export class MailService {
  private readonly config = loadConfig();
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null = null;

  /** E-mail can be sent and links can point to the app. */
  get configured(): boolean {
    return !!this.config.APP_URL && (!!this.config.MAIL_OUTBOX || !!this.config.SMTP_HOST);
  }

  /** Where links in e-mails point (the web app). */
  get appUrl(): string {
    return this.config.APP_URL!.replace(/\/+$/, '');
  }

  async send(mail: Mail): Promise<void> {
    if (!this.configured) throw new ServiceUnavailableException('E-mail is not set up');
    if (this.config.MAIL_OUTBOX) {
      await mkdir(this.config.MAIL_OUTBOX, { recursive: true });
      const file = `${Date.now()}-${randomUUID()}.json`;
      await writeFile(join(this.config.MAIL_OUTBOX, file), JSON.stringify(mail));
      return;
    }
    this.transport ??= createTransport({
      host: this.config.SMTP_HOST,
      port: this.config.SMTP_PORT,
      secure: this.config.SMTP_PORT === 465, // 587 upgrades with STARTTLS
      requireTLS: true,
      auth: this.config.SMTP_USER
        ? { user: this.config.SMTP_USER, pass: this.config.SMTP_PASSWORD }
        : undefined,
    });
    try {
      await this.transport.sendMail({ from: this.config.MAIL_FROM, ...mail });
    } catch (error) {
      // never log the address or the content (links are secrets)
      this.logger.error(`Sending an e-mail failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('The e-mail could not be sent. Please try again.');
    }
  }
}
