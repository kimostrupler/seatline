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
  return config;
}
