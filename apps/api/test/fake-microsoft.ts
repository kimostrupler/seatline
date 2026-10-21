import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface FakeUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  department?: string | null;
  jobTitle?: string | null;
  accountEnabled?: boolean;
  userType?: string;
}

/**
 * Stand-in for login.microsoftonline.com (client-credentials tokens) and Microsoft Graph
 * (/v1.0/users with paging), so the people sync can be tested without the internet.
 */
export class FakeMicrosoft {
  users = new Map<string, FakeUser[]>(); // by Entra tenant id
  tokenError: { status: number; body: object } | null = null;
  graphStatus = 200;
  pageSize = 2;
  private server: Server | null = null;

  get url() {
    return `http://127.0.0.1:${(this.server!.address() as AddressInfo).port}`;
  }

  async start() {
    this.server = createServer((req, res) => {
      const url = new URL(req.url!, 'http://x');
      const json = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      const token = /^\/([^/]+)\/oauth2\/v2\.0\/token$/.exec(url.pathname);
      if (token && req.method === 'POST') {
        if (this.tokenError) return json(this.tokenError.status, this.tokenError.body);
        return json(200, {
          access_token: `token-for-${token[1]}`,
          token_type: 'Bearer',
          expires_in: 3600,
        });
      }
      if (url.pathname === '/v1.0/users') {
        if (this.graphStatus !== 200)
          return json(this.graphStatus, { error: { code: 'Authorization_RequestDenied' } });
        const tid = /^Bearer token-for-(.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '';
        const all = this.users.get(tid) ?? [];
        const skip = Number(url.searchParams.get('skip') ?? 0);
        const page = all.slice(skip, skip + this.pageSize);
        const next = skip + this.pageSize < all.length;
        return json(200, {
          value: page.map((u) => ({
            department: null,
            jobTitle: null,
            accountEnabled: true,
            userType: 'Member',
            ...u,
          })),
          ...(next
            ? { '@odata.nextLink': `${this.url}/v1.0/users?skip=${skip + this.pageSize}` }
            : {}),
        });
      }
      json(404, {});
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
  }

  async stop() {
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}
