import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { TEAMS_COLOR_ICON, TEAMS_OUTLINE_ICON } from './icons';

/** A stable app id per Seatline address (Teams needs a GUID that never changes). */
export function teamsAppId(host: string): string {
  const h = createHash('sha256').update(`seatline-teams:${host}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/**
 * The Teams app (manifest 1.17): one personal tab with the map, also shown in Outlook and the
 * Microsoft 365 app. Single sign-on through our Entra app (webApplicationInfo).
 */
export function teamsManifest(appUrl: string, clientId: string, siteUrl: string) {
  const base = appUrl.replace(/\/+$/, '');
  const host = new URL(base).host;
  return {
    $schema:
      'https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json',
    manifestVersion: '1.17',
    version: '1.0.0',
    id: teamsAppId(host),
    developer: {
      name: 'Seatline',
      websiteUrl: siteUrl,
      privacyUrl: `${siteUrl}/legal/privacy`,
      termsOfUseUrl: `${siteUrl}/legal/terms`,
    },
    name: { short: 'Seatline', full: 'Seatline – who sits where' },
    description: {
      short: 'See who sits where and find a free desk.',
      full: 'Seatline shows your office floors: who sits where, free desks, meeting rooms and team areas. Find a colleague’s desk without leaving Teams or Outlook.',
    },
    icons: { color: 'color.png', outline: 'outline.png' },
    accentColor: '#2563EB',
    staticTabs: [
      {
        entityId: 'map',
        name: 'Seatline',
        contentUrl: `${base}/teams`,
        websiteUrl: `${base}/map`,
        scopes: ['personal'],
      },
    ],
    permissions: ['identity'],
    validDomains: [host],
    webApplicationInfo: { id: clientId, resource: `api://${host}/${clientId}` },
  };
}

/** The zip an admin uploads to Teams (manifest + two icons). */
export function teamsAppPackage(appUrl: string, clientId: string, siteUrl: string): Uint8Array {
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(teamsManifest(appUrl, clientId, siteUrl), null, 2)),
    'color.png': Buffer.from(TEAMS_COLOR_ICON, 'base64'),
    'outline.png': Buffer.from(TEAMS_OUTLINE_ICON, 'base64'),
  });
}
