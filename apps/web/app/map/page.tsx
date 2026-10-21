import { Suspense } from 'react';
import { Workspace } from '@/components/workspace/workspace';
import { requireMember } from '@/lib/server/require-member';

export default async function MapPage() {
  await requireMember();
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
