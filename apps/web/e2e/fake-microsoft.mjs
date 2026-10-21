// Fake login.microsoftonline.com for browser tests: authorize → code → ID token (RS256).
// Who signs in comes from login_hint (an e-mail); the organisation (tid) from its domain.
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const port = Number(process.env.FAKE_MS_PORT ?? 3104);
const base = `http://127.0.0.1:${port}`;
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'fake-1', alg: 'RS256', use: 'sig' };

const uuidFrom = (text) => {
  const h = createHash('sha256').update(text).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const decode = (text) => JSON.parse(Buffer.from(text, 'base64url').toString());

createServer((req, res) => {
  const url = new URL(req.url, base);
  const json = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/common/discovery/v2.0/keys') return json(200, { keys: [jwk] });
  if (url.pathname === '/organizations/oauth2/v2.0/authorize') {
    const email = url.searchParams.get('login_hint') ?? 'first@newco.example';
    const code = encode({
      email,
      nonce: url.searchParams.get('nonce'),
      clientId: url.searchParams.get('client_id'),
    });
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', code);
    back.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }
  if (url.pathname === '/organizations/oauth2/v2.0/token' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const { email, nonce, clientId } = decode(new URLSearchParams(body).get('code'));
      const tid = uuidFrom(email.split('@')[1]);
      const local = email.split('@')[0];
      const idToken = await new SignJWT({
        tid,
        oid: uuidFrom(email),
        name: local.charAt(0).toUpperCase() + local.slice(1) + ' Tester',
        preferred_username: email,
        nonce,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'fake-1' })
        .setIssuer(`${base}/${tid}/v2.0`)
        .setAudience(clientId)
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(privateKey);
      json(200, { id_token: idToken, token_type: 'Bearer' });
    });
    return;
  }
  json(404, {});
}).listen(port, '127.0.0.1', () => console.log(`fake Microsoft on ${base}`));
