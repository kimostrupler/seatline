import { Injectable } from '@nestjs/common';
import { loadConfig } from '../config';

/** Only the fields Seatline needs (data minimisation, nDSG). */
export interface GraphUser {
  id: string;
  displayName: string | null;
  mail: string | null;
  userPrincipalName: string;
  department: string | null;
  jobTitle: string | null;
  accountEnabled: boolean | null;
  userType: string | null;
}

export type SyncErrorKind = 'not_configured' | 'consent_required' | 'failed';

export class GraphError extends Error {
  constructor(
    readonly kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
  }
}

// AADSTS codes meaning "this organisation hasn't approved Seatline (yet)"
const CONSENT_CODES = [
  'AADSTS65001',
  'AADSTS700016',
  'AADSTS7000229',
  'AADSTS500011',
  'AADSTS90094',
];

/**
 * Reads a customer's directory with Microsoft Graph, as the Seatline app itself
 * (application permission User.Read.All, granted by the customer's admin once).
 */
@Injectable()
export class GraphClient {
  private readonly config = loadConfig();

  private async appToken(entraTenantId: string): Promise<string> {
    const { ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET, ENTRA_LOGIN_URL, GRAPH_URL } = this.config;
    if (!ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET)
      throw new GraphError('not_configured', 'Microsoft sign-in is not configured');
    const res = await fetch(`${ENTRA_LOGIN_URL}/${entraTenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ENTRA_CLIENT_ID,
        client_secret: ENTRA_CLIENT_SECRET,
        scope: `${GRAPH_URL}/.default`,
        grant_type: 'client_credentials',
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };
    if (res.ok && body.access_token) return body.access_token;
    const detail = `${body.error ?? res.status}: ${body.error_description ?? ''}`.slice(0, 300);
    const consent =
      body.error === 'unauthorized_client' ||
      CONSENT_CODES.some((code) => body.error_description?.includes(code));
    throw new GraphError(consent ? 'consent_required' : 'failed', detail);
  }

  /** All users of the organisation (follows paging). */
  async listUsers(entraTenantId: string): Promise<GraphUser[]> {
    const token = await this.appToken(entraTenantId);
    const fields =
      'id,displayName,mail,userPrincipalName,department,jobTitle,accountEnabled,userType';
    let url: string | undefined = `${this.config.GRAPH_URL}/v1.0/users?$select=${fields}&$top=999`;
    const users: GraphUser[] = [];
    for (let page = 0; url && page < 500; page++) {
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (res.status === 401 || res.status === 403)
        throw new GraphError('consent_required', `Microsoft Graph refused access (${res.status})`);
      if (!res.ok) throw new GraphError('failed', `Microsoft Graph error ${res.status}`);
      const body = (await res.json()) as { value: GraphUser[]; '@odata.nextLink'?: string };
      users.push(...body.value);
      url = body['@odata.nextLink'];
    }
    return users;
  }
}
