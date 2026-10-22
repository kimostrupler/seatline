import { jwtVerify } from 'jose';
import { z } from 'zod';

/** Signed in with Microsoft. */
export const microsoftIdentitySchema = z.object({
  kind: z.literal('microsoft').default('microsoft'), // tokens from before e-mail sign-in had none
  /** Microsoft Entra tenant id (the customer's Microsoft 365 organisation) */
  tid: z.uuid(),
  /** Entra object id of the user */
  oid: z.uuid(),
  name: z.string().min(1).max(200),
  email: z.string().min(3).max(320),
});

/** Signed in with a one-time e-mail link: the address is proven, nothing else. */
export const emailIdentitySchema = z.object({
  kind: z.literal('email'),
  email: z.string().min(3).max(320),
  /** the workspace picked when the address belongs to several (null = not picked yet) */
  tenantId: z.uuid().nullable(),
});

/** Who signed in, as vouched for by the web app (BFF). */
export const identitySchema = z.union([microsoftIdentitySchema, emailIdentitySchema]);
export type Identity = z.infer<typeof identitySchema>;
export type MicrosoftIdentity = z.infer<typeof microsoftIdentitySchema>;
export type EmailIdentity = z.infer<typeof emailIdentitySchema>;

export const INTERNAL_ISSUER = 'seatline-web';
export const INTERNAL_AUDIENCE = 'seatline-api';

/**
 * Verifies the short-lived token the web app signs for each request (HS256, shared secret).
 * Returns null for anything invalid — never trust a token that doesn't verify.
 */
export async function verifyInternalToken(token: string, secret: string): Promise<Identity | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: INTERNAL_ISSUER,
      audience: INTERNAL_AUDIENCE,
      algorithms: ['HS256'],
      maxTokenAge: '2m',
    });
    const parsed = identitySchema.safeParse(payload);
    return parsed.success ? { ...parsed.data, email: parsed.data.email.toLowerCase() } : null;
  } catch {
    return null;
  }
}
