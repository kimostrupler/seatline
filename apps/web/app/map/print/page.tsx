import { Suspense } from 'react';
import { PrintFloor } from '@/components/map/print-floor';
import { requireMember } from '@/lib/server/require-member';

export default async function PrintFloorPage() {
  await requireMember();
  return (
    <Suspense>
      <PrintFloor />
    </Suspense>
  );
}
