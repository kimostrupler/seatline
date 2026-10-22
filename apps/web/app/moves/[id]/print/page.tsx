import { Suspense } from 'react';
import { MovingList } from '@/components/moves/moving-list';
import { requireMember } from '@/lib/server/require-member';

export default async function MovingListPage({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  return (
    <Suspense>
      <MovingList id={id} />
    </Suspense>
  );
}
