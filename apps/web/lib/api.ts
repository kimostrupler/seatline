import { currentIdentity } from './identity';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the API through the /api rewrite with the dev identity headers. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { tenantId, userId } = currentIdentity();
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      'x-tenant-id': tenantId,
      'x-user-id': userId,
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message)
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // not JSON
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}
