/**
 * Content Security Policy: everything comes from our own origin (no third-party scripts, fonts
 * or trackers). Scripts run only with this request's nonce (Next.js stamps its own scripts with
 * it; 'strict-dynamic' lets them load the page's chunks), so injected inline scripts can't run.
 * Styles stay 'unsafe-inline' (React and the map set inline styles). Plan images are blob: URLs.
 * No site may show the app in a frame (clickjacking). Set per request in middleware.ts.
 */
export function contentSecurityPolicy(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** A fresh random nonce per request (Web Crypto: works in middleware). */
export const newNonce = () => btoa(crypto.randomUUID());
