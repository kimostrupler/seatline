import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { LeadsPage } from '@/components/owner/leads-page';
import { apiAsUser, currentUser } from '@/lib/server/auth';
import { webConfig } from '@/lib/server/config';
import type { LeadList } from '@/lib/types';

export const metadata: Metadata = { title: 'Seatline', robots: { index: false, follow: false } };

/** The operator's outreach leads. A 404 for anyone but OWNER_EMAILS, like /owner. */
export default async function OwnerLeadsPage() {
  let initial: LeadList | null = null;
  if (webConfig().AUTH_MODE === 'entra') {
    const user = await currentUser();
    if (!user) notFound();
    const res = await apiAsUser<LeadList>(user, '/owner/leads');
    if (res.status !== 200) notFound();
    initial = res.body;
  }
  const { site: _site, ...messages } = await getMessages();
  // this page's texts travel only with this page (the layout leaves them out everywhere else)
  return (
    <NextIntlClientProvider messages={messages}>
      <LeadsPage initial={initial} />
    </NextIntlClientProvider>
  );
}
