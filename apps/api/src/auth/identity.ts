import { jwtVerify } from 'jose';
import { z } from 'zod';

/** Who signed in with Microsoft, as vouched for by the web app (BFF). */
export const identitySchema = z.object({
  /** Microsoft Entra tenant id (the customer's Microsoft 365 organisation) */
  tid: z.uuid(),
  /** Entra object id of the user */
  oid: z.uuid(),
  name: z.string().min(1).max(200),
  email: z.string().min(3).max(320),
});
export type Identity = z.infer<typeof identitySchema>;

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
