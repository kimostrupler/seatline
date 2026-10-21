import type { SeatOccupancy } from '@seatline/shared';
import { cn } from '@/lib/utils';

const STYLES: Record<SeatOccupancy, string> = {
  free: 'bg-(--seat-free-fill) border-(--seat-free-stroke)',
  taken: 'bg-(--seat-taken-fill) border-(--seat-taken-stroke)',
  reserved: 'bg-(--seat-reserved-fill) border-(--seat-reserved-stroke)',
  blocked: 'bg-(--seat-blocked-fill) border-(--seat-blocked-stroke) border-dashed',
};

/** Small swatch matching the map's seat colours. Always paired with a text label. */
export function StatusDot({ status, className }: { status: SeatOccupancy; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full border-[1.5px]',
        STYLES[status],
        className,
      )}
    />
  );
}
