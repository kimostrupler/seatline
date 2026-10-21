import { currentIdentity } from './identity';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function authHeaders(): Record<string, string> {
  const { tenantId, userId } = currentIdentity();
  return { 'x-tenant-id': tenantId, 'x-user-id': userId };
}

async function errorFrom(res: Response): Promise<ApiError> {
  let message = res.statusText;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    // not JSON
  }
  return new ApiError(res.status, message);
}

/** Binary download (e.g. the floor plan image). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await fetch(`/api${path}`, { headers: authHeaders() });
  if (!res.ok) throw await errorFrom(res);
  return res.blob();
}

/** File upload as multipart form data (field "file"). */
export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`/api${path}`, { method: 'POST', headers: authHeaders(), body });
  if (!res.ok) throw await errorFrom(res);
  return (await res.json()) as T;
}

/** Calls the API through the /api proxy with the dev identity headers. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      ...authHeaders(),
      ...(init?.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) throw await errorFrom(res);
  return (res.status === 204 ? undefined : await res.json()) as T;
}
