import { EncryptJWT, jwtDecrypt, SignJWT } from 'jose';

// Works in Node and in the edge middleware (Web Crypto only).

/** Who signed in: with Microsoft, or with a one-time e-mail link. Kept in an encrypted, httpOnly cookie. */
export type SessionUser = (
  | { kind: 'microsoft'; tid: string; oid: string; name: string; email: string }
  | {
      kind: 'email';
      email: string;
      /** the workspace picked when the address belongs to several (null = not picked) */
      tenantId: string | null;
    }
) & {
  /**
   * This sign-in's random id: signing out ends it in the API too, so a copy of the cookie
   * stops working. Cookies from before have none (they still expire after 30 days).
   */
  sid?: string;
};

/** "Name · e-mail" (or just the e-mail) for "signed in as". */
export const userLabel = (user: SessionUser) =>
  user.kind === 'microsoft' ? `${user.name} · ${user.email}` : user.email;

export const SESSION_COOKIE = 'sl_session';
export const OIDC_COOKIE = 'sl_oidc';
/** how long a sign-in lasts: 30 days (sign out ends it at once; leavers lose access anyway) */
export const SESSION_HOURS = 30 * 24;

async function keyFrom(secret: string, purpose: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${purpose}:${secret}`),
  );
  return new Uint8Array(digest);
}

export async function seal(
  payload: Record<string, unknown>,
  secret: string,
  purpose: string,
  expiresIn: string,
) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .encrypt(await keyFrom(secret, purpose));
}

export async function unseal<T>(
  token: string | undefined,
  secret: string,
  purpose: string,
): Promise<T | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtDecrypt(token, await keyFrom(secret, purpose));
    return payload as T;
  } catch {
    return null; // tampered, expired or from another secret
  }
}

export const sealSession = (user: SessionUser, secret: string) =>
  seal({ ...user, sid: user.sid ?? newSid() }, secret, 'session', `${SESSION_HOURS}h`);

const newSid = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export async function readSession(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  const s = await unseal<Record<string, string | null | undefined>>(token, secret, 'session');
  const sid = typeof s?.sid === 'string' ? { sid: s.sid } : {};
  if (s?.kind === 'email' && s.email)
    return { kind: 'email', email: s.email, tenantId: s.tenantId ?? null, ...sid };
  // Microsoft (cookies from before e-mail sign-in have no kind)
  if (s?.tid && s.oid)
    return {
      kind: 'microsoft',
      tid: s.tid,
      oid: s.oid,
      name: s.name ?? '',
      email: s.email ?? '',
      ...sid,
    };
  return null;
}

/** The short-lived token the API trusts for one request (see apps/api/src/auth/identity.ts). */
export async function internalToken(user: SessionUser, secret: string): Promise<string> {
  const sid = user.sid ? { sid: user.sid } : {};
  const claims =
    user.kind === 'email'
      ? { kind: 'email', email: user.email, tenantId: user.tenantId, ...sid }
      : {
          kind: 'microsoft',
          tid: user.tid,
          oid: user.oid,
          name: user.name,
          email: user.email,
          ...sid,
        };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('seatline-web')
    .setAudience('seatline-api')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret));
}
