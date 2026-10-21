/** What a browser error report may contain — nothing personal (no query strings, no user). */
export interface ClientErrorReport {
  message: string;
  stack?: string;
  path: string;
  kind: 'error' | 'rejection' | 'render';
}

const cut = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');

/** Keep only safe, short fields; drop query strings and e-mail-like text. */
export function sanitizeReport(input: unknown): ClientErrorReport | null {
  if (!input || typeof input !== 'object') return null;
  const r = input as Record<string, unknown>;
  const scrub = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>');
  const message = scrub(cut(r.message, 500));
  if (!message) return null;
  const kind = r.kind === 'rejection' || r.kind === 'render' ? r.kind : 'error';
  return {
    message,
    stack: scrub(cut(r.stack, 2000)).split('\n').slice(0, 8).join('\n') || undefined,
    path: cut(r.path, 200).split('?')[0]!.split('#')[0]! || '/',
    kind,
  };
}

/** Send a browser error to the server log (Azure, Switzerland). Never throws. */
export function reportClientError(error: unknown, kind: ClientErrorReport['kind']) {
  try {
    const e = error instanceof Error ? error : new Error(String(error));
    const body = JSON.stringify({
      message: e.message,
      stack: e.stack,
      path: window.location.pathname,
      kind,
    });
    if (!navigator.sendBeacon?.('/client-errors', new Blob([body], { type: 'application/json' })))
      void fetch('/client-errors', { method: 'POST', body, keepalive: true }).catch(() => {});
  } catch {
    // reporting must never break the page
  }
}
