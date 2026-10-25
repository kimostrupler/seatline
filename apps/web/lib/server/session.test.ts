import { describe, expect, it } from 'vitest';
import { internalToken, readSession, sealSession } from './session';

const SECRET = 's'.repeat(40);

describe('session cookie', () => {
  it('gives every new sign-in its own id, keeps it, and passes it to the API', async () => {
    const user = { kind: 'email' as const, email: 'a@b.ch', tenantId: null };
    const one = await readSession(await sealSession(user, SECRET), SECRET);
    const two = await readSession(await sealSession(user, SECRET), SECRET);
    expect(one?.sid).toMatch(/^[0-9a-f]{32}$/);
    expect(two?.sid).not.toBe(one?.sid);
    // re-sealing (e.g. after picking a workspace) keeps the same sign-in
    const pickedUser = { ...user, sid: one!.sid, tenantId: '11111111-1111-4111-8111-111111111111' };
    const picked = await readSession(await sealSession(pickedUser, SECRET), SECRET);
    expect(picked?.sid).toBe(one?.sid);
    const token = await internalToken(one!, SECRET);
    const claims = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
    expect(claims.sid).toBe(one?.sid);
  });
});
