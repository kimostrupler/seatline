import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, newNonce } from './csp';

describe('content security policy', () => {
  it('lets only scripts with this request’s nonce run (no unsafe-inline scripts)', () => {
    const csp = contentSecurityPolicy('abc123');
    const script = csp.split('; ').find((d) => d.startsWith('script-src'))!;
    expect(script).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(contentSecurityPolicy('x', true)).toContain("'unsafe-eval'");
  });
  it('makes a new nonce every time', () => {
    expect(newNonce()).not.toBe(newNonce());
  });
});
