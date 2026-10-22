import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { OwnerDashboard } from '@/components/owner/owner-dashboard';
import { apiAsUser, currentUser } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import type { OwnerOverview } from '@/lib/types';

export const metadata: Metadata = { title: 'Seatline', robots: { index: false, follow: false } };

/**
 * The operator's dashboard. Not linked anywhere; for anyone but OWNER_EMAILS the API says 404
 * and so does this page — exactly like an address that doesn't exist.
 */
export default async function OwnerPage() {
  let initial: OwnerOverview | null = null;
  if (webConfig().AUTH_MODE === 'entra') {
    const user = await currentUser();
    if (!user) notFound();
    const res = await apiAsUser<OwnerOverview>(user, '/owner/overview');
    if (res.status !== 200) notFound();
    initial = res.body;
  }
  const { site: _site, ...messages } = await getMessages();
  // this page's texts travel only with this page (the layout leaves them out everywhere else)
  return (
    <NextIntlClientProvider messages={messages}>
      <OwnerDashboard initial={initial} />
    </NextIntlClientProvider>
  );
}
