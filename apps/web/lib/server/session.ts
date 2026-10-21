import { EncryptJWT, jwtDecrypt, SignJWT } from 'jose';

// Works in Node and in the edge middleware (Web Crypto only).

/** Who signed in with Microsoft. Kept in an encrypted, httpOnly cookie. */
export interface SessionUser {
  tid: string;
  oid: string;
  name: string;
  email: string;
}

export const SESSION_COOKIE = 'sl_session';
export const OIDC_COOKIE = 'sl_oidc';
export const SESSION_HOURS = 10;

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
  seal({ ...user }, secret, 'session', `${SESSION_HOURS}h`);

export async function readSession(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  const s = await unseal<SessionUser>(token, secret, 'session');
  return s?.tid && s.oid ? { tid: s.tid, oid: s.oid, name: s.name, email: s.email } : null;
}

/** The short-lived token the API trusts for one request (see apps/api/src/auth/identity.ts). */
export async function internalToken(user: SessionUser, secret: string): Promise<string> {
  return new SignJWT({ tid: user.tid, oid: user.oid, name: user.name, email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('seatline-web')
    .setAudience('seatline-api')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(new TextEncoder().encode(secret));
}
