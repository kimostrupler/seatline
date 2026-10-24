import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { clientIp } from './forms';

const req = (xff?: string) => ({ headers: new Headers(xff ? { 'x-forwarded-for': xff } : {}) });

describe('client address for rate limits', () => {
  it('trusts only the entry the ingress added (the last one)', () => {
    expect(clientIp(req('203.0.113.7'))).toBe('203.0.113.7');
    // a made-up first entry from the caller doesn't change who they are
    expect(clientIp(req('1.2.3.4, 203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIp(req())).toBe('unknown');
  });
});
