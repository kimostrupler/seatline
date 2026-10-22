import { DeskPage } from '@/components/map/desk-page';
import { requireMember } from '@/lib/server/require-member';

/** What a desk's QR sticker opens: who sits there (signed-in colleagues only). */
export default async function Desk({ params }: { params: Promise<{ seatId: string }> }) {
  await requireMember();
  return <DeskPage seatId={(await params).seatId} />;
}
