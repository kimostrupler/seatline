import 'server-only';
import { z } from 'zod';

const schema = z.object({
  /** dev = demo company/user switcher (local only); entra = Sign in with Microsoft */
  AUTH_MODE: z.enum(['dev', 'entra']).default('dev'),
  API_URL: z.url().default('http://localhost:3001'),
  /** public address of this web app, e.g. https://seatline.example.ch (for Microsoft redirects) */
  APP_URL: z.url().default('http://localhost:3000'),
  ENTRA_CLIENT_ID: z.string().default(''),
  ENTRA_CLIENT_SECRET: z.string().default(''),
  ENTRA_LOGIN_URL: z.url().default('https://login.microsoftonline.com'),
  /** encrypts the session cookie */
  SESSION_SECRET: z.string().default(''),
  /** signs the per-request identity token for the API (same value as in apps/api) */
  INTERNAL_AUTH_SECRET: z.string().default(''),
});

export type WebConfig = z.infer<typeof schema>;

export function webConfig(): WebConfig {
  const config = schema.parse(process.env);
  if (config.AUTH_MODE === 'entra') {
    const missing = (
      ['ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'SESSION_SECRET', 'INTERNAL_AUTH_SECRET'] as const
    ).filter((k) => !config[k]);
    if (missing.length) throw new Error(`AUTH_MODE=entra needs ${missing.join(', ')}`);
    if (config.SESSION_SECRET.length < 32 || config.INTERNAL_AUTH_SECRET.length < 32)
      throw new Error('SESSION_SECRET and INTERNAL_AUTH_SECRET must be at least 32 characters');
  }
  return config;
}
