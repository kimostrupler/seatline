import { Suspense } from 'react';
import { DeskLabels } from '@/components/map/desk-labels';
import { requireMember } from '@/lib/server/require-member';

export default async function DeskLabelsPage() {
  await requireMember();
  return (
    <Suspense>
      <DeskLabels />
    </Suspense>
  );
}
