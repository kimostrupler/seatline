import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { finishLogin, SignInError, startLogin, verifyIdToken } from './oidc';
import { internalToken, readSession, sealSession } from './session';

const TID = '72f988bf-86f1-41af-91ab-2d7cd011db47';
const OID = '00000000-0000-4000-8000-000000000001';
let server: Server;
let loginUrl: string;
let privateKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/common/discovery/v2.0/keys') return res.end(JSON.stringify({ keys: [jwk] }));
    if (req.url === '/organizations/oauth2/v2.0/token') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        const form = new URLSearchParams(body);
        if (form.get('code') !== 'good-code') {
          res.statusCode = 400;
          return res.end(
            JSON.stringify({ error: 'invalid_grant', error_description: 'AADSTS70000: bad code' }),
          );
        }
        res.end(JSON.stringify({ id_token: await idToken({ nonce: 'n-1' }) }));
      });
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  loginUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

function idToken(over: Record<string, unknown> = {}, key: CryptoKey = privateKey) {
  const { iss, aud, exp, ...claims } = over;
  return new SignJWT({
    tid: TID,
    oid: OID,
    name: 'Anna Meier',
    preferred_username: 'Anna@Contoso.com',
    nonce: 'n-1',
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer((iss as string) ?? `${loginUrl}/${TID}/v2.0`)
    .setAudience((aud as string) ?? 'client-1')
    .setIssuedAt()
    .setExpirationTime((exp as string) ?? '1h')
    .sign(key);
}

const verify = (token: string, nonce = 'n-1') =>
  verifyIdToken(token, { loginUrl, clientId: 'client-1', transaction: { nonce } });

describe('Microsoft ID token checks', () => {
  it('accepts a valid token and reads the identity', async () => {
    expect(await verify(await idToken())).toEqual({
      tid: TID,
      oid: OID,
      name: 'Anna Meier',
      email: 'anna@contoso.com',
    });
  });

  it('rejects wrong audience, foreign issuer, wrong nonce, expired or foreign-signed tokens', async () => {
    await expect(verify(await idToken({ aud: 'other-app' }))).rejects.toThrow(SignInError);
    // a token claiming tenant A but issued for tenant B
    await expect(
      verify(await idToken({ iss: `${loginUrl}/11111111-1111-4111-8111-111111111111/v2.0` })),
    ).rejects.toThrow('Unexpected token issuer');
    await expect(verify(await idToken(), 'other-nonce')).rejects.toThrow(SignInError);
    await expect(verify(await idToken({ exp: '-5m' }))).rejects.toThrow(SignInError);
    const stranger = await generateKeyPair('RS256');
    await expect(verify(await idToken({}, stranger.privateKey))).rejects.toThrow(SignInError);
  });

  it('builds a PKCE login URL and exchanges the code', async () => {
    const { url, transaction } = await startLogin({
      loginUrl,
      clientId: 'client-1',
      redirectUri: 'https://app/auth/callback',
    });
    const params = new URL(url).searchParams;
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('state')).toBe(transaction.state);
    expect(params.get('code_challenge')).not.toBe(transaction.verifier);

    const user = await finishLogin({
      loginUrl,
      clientId: 'client-1',
      clientSecret: 's',
      redirectUri: 'https://app/auth/callback',
      code: 'good-code',
      transaction: { ...transaction, nonce: 'n-1' },
    });
    expect(user.oid).toBe(OID);
    await expect(
      finishLogin({
        loginUrl,
        clientId: 'client-1',
        clientSecret: 's',
        redirectUri: 'x',
        code: 'bad',
        transaction,
      }),
    ).rejects.toThrow('AADSTS70000');
  });
});

describe('session cookie', () => {
  const user = { tid: TID, oid: OID, name: 'Anna', email: 'anna@contoso.com' };
  const secret = 's'.repeat(40);

  it('round-trips, and refuses tampered cookies or another secret', async () => {
    const cookie = await sealSession(user, secret);
    expect(await readSession(cookie, secret)).toEqual(user);
    expect(await readSession(cookie, 'x'.repeat(40))).toBeNull();
    expect(await readSession(cookie.slice(0, -4) + 'AAAA', secret)).toBeNull();
    expect(await readSession(undefined, secret)).toBeNull();
    expect(cookie).not.toContain('anna'); // encrypted, not just signed
  });

  it('mints the API token', async () => {
    const token = await internalToken(user, secret);
    expect(token.split('.')).toHaveLength(3);
  });
});
