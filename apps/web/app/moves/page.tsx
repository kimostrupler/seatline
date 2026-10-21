import { MovesPage } from '@/components/moves/moves-page';
import { requireMember } from '@/lib/server/require-member';

export default async function Moves() {
  await requireMember();
  return <MovesPage />;
}
