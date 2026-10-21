import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { SessionUser } from './session';

/**
 * "Sign in with Microsoft" — OpenID Connect authorization code flow with PKCE,
 * for work accounts of any organisation (multi-tenant app registration).
 */

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const random = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export interface LoginTransaction {
  state: string;
  nonce: string;
  verifier: string;
}

export async function startLogin(opts: {
  loginUrl: string;
  clientId: string;
  redirectUri: string;
  loginHint?: string;
}): Promise<{ url: string; transaction: LoginTransaction }> {
  const transaction = { state: random(), nonce: random(), verifier: random(48) };
  const challenge = b64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transaction.verifier)),
    ),
  );
  const url = new URL(`${opts.loginUrl}/organizations/oauth2/v2.0/authorize`);
  url.search = new URLSearchParams({
    client_id: opts.clientId,
    response_type: 'code',
    redirect_uri: opts.redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state: transaction.state,
    nonce: transaction.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(opts.loginHint ? { login_hint: opts.loginHint } : {}),
  }).toString();
  return { url: url.toString(), transaction };
}

export class SignInError extends Error {}

const jwksCache = new Map<string, JWTVerifyGetKey>();
const jwks = (loginUrl: string) => {
  let set = jwksCache.get(loginUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${loginUrl}/common/discovery/v2.0/keys`));
    jwksCache.set(loginUrl, set);
  }
  return set;
};

/** Exchanges the code and verifies the ID token: signature, audience, issuer = the user's own tenant, nonce, expiry. */
export async function finishLogin(opts: {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  transaction: LoginTransaction;
}): Promise<SessionUser> {
  const res = await fetch(`${opts.loginUrl}/organizations/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: opts.redirectUri,
      code_verifier: opts.transaction.verifier,
      scope: 'openid profile email',
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    error_description?: string;
  };
  if (!res.ok || !body.id_token)
    throw new SignInError(body.error_description ?? `Token request failed (${res.status})`);
  return verifyIdToken(body.id_token, opts);
}

export async function verifyIdToken(
  idToken: string,
  opts: { loginUrl: string; clientId: string; transaction: Pick<LoginTransaction, 'nonce'> },
): Promise<SessionUser> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks(opts.loginUrl), {
      audience: opts.clientId,
      algorithms: ['RS256'],
      clockTolerance: 60,
    }));
  } catch (error) {
    throw new SignInError(
      `Invalid ID token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const tid = typeof payload.tid === 'string' ? payload.tid : '';
  // multi-tenant: the issuer must be exactly the tenant the token claims to come from
  if (!tid || payload.iss !== `${opts.loginUrl}/${tid}/v2.0`)
    throw new SignInError('Unexpected token issuer');
  if (payload.nonce !== opts.transaction.nonce)
    throw new SignInError('Sign-in response does not match the request');
  const oid = typeof payload.oid === 'string' ? payload.oid : '';
  const email = String(payload.email ?? payload.preferred_username ?? '').toLowerCase();
  if (!oid || !email) throw new SignInError('The Microsoft account has no e-mail address');
  return { tid, oid, email, name: String(payload.name ?? email) };
}
