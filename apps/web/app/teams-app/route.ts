import { webConfig } from '@/lib/server/config';
import { siteUrl } from '@/lib/site';
import { teamsAppPackage } from '@/lib/teams/manifest';

/** Download the Teams / Outlook app for this Seatline (admins upload it in Teams). */
export function GET() {
  const config = webConfig();
  if (!config.ENTRA_CLIENT_ID)
    return new Response('Microsoft sign-in is not set up', { status: 404 });
  const zip = teamsAppPackage(config.APP_URL, config.ENTRA_CLIENT_ID, siteUrl(config.APP_URL));
  return new Response(Buffer.from(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="seatline-teams-app.zip"',
    },
  });
}
