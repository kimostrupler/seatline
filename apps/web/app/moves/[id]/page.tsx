import { PlanPage } from '@/components/moves/plan-page';
import { requireMember } from '@/lib/server/require-member';

export default async function MovePlan({ params }: { params: Promise<{ id: string }> }) {
  await requireMember();
  const { id } = await params;
  return <PlanPage id={id} />;
}
