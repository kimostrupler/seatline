import { PlanningPage } from '@/components/planning/planning-page';
import { requireMember } from '@/lib/server/require-member';

export default async function Planning() {
  await requireMember();
  return <PlanningPage />;
}
