import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().default(3001),
  /** Azure Blob Storage. Locally: Azurite from infra/docker-compose.yml. */
  AZURE_STORAGE_CONNECTION_STRING: z.string().min(1).default('UseDevelopmentStorage=true'),
  AZURE_STORAGE_CONTAINER: z.string().min(3).default('floor-plans'),
  /**
   * Shared with the web app, which signs a short-lived token per request saying who
   * signed in with Microsoft. Unset = Microsoft sign-in is off (dev auth only).
   */
  INTERNAL_AUTH_SECRET: z.string().min(32).optional(),
  /** Entra app registration (people sync reads Microsoft Graph with app permissions). */
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_LOGIN_URL: z.url().default('https://login.microsoftonline.com'),
  GRAPH_URL: z.url().default('https://graph.microsoft.com'),
  /** Run the background job worker (pg-boss) inside this process. */
  /** "your new desk" e-mails wait this long, so an undone move sends nothing */
  DESK_MAIL_DELAY_SECONDS: z.coerce.number().int().min(0).default(120),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /**
   * Stripe billing (per seat per month). All three unset = billing is off: nothing is ever
   * read-only (self-hosted, local development).
   */
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** the monthly per-seat price (Stripe price id, e.g. price_…) */
  STRIPE_PRICE_ID: z.string().optional(),
  /** tests only: a fake Stripe server (http://localhost:port) */
  STRIPE_API_BASE: z.url().optional(),
  /** The plan engine (apps/plan-engine) that reads DXF/PDF plans. Unset = plan import is off. */
  PLAN_ENGINE_URL: z.url().optional(),
  /** Sent to the plan engine as x-internal-token (same value as its PLAN_ENGINE_TOKEN). */
  PLAN_ENGINE_TOKEN: z.string().optional(),
  /**
   * E-mail (sign-in links, invitations), sent through SMTP — Hostpoint for seatline.ch.
   * Unset = sign-in by e-mail is off (Microsoft only).
   */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('Seatline <hello@seatline.ch>'),
  /** public address of the web app: sign-in links point there (never taken from a request) */
  APP_URL: z.url().optional(),
  /** tests only: write e-mails as JSON files into this folder instead of sending them */
  MAIL_OUTBOX: z.string().optional(),
  /** Trust x-tenant-id / x-user-id headers. Dev only — replaced by Entra ID in Phase 4. */
  DEV_AUTH: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = envSchema.parse(env);
  if (config.DEV_AUTH && config.NODE_ENV === 'production') {
    throw new Error('DEV_AUTH must never be enabled in production');
  }
  if (config.MAIL_OUTBOX && config.NODE_ENV === 'production') {
    throw new Error('MAIL_OUTBOX is for tests only');
  }
  return config;
}
