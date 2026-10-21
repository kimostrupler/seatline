import { Suspense } from 'react';
import { BillingPage } from '@/components/billing/billing-page';
import { requireMember } from '@/lib/server/require-member';

export default async function Billing() {
  await requireMember();
  return (
    <Suspense>
      <BillingPage />
    </Suspense>
  );
}
