import { SEAT_OCCUPANCY } from '@seatline/shared';

// Placeholder until Phase 2 (app shell, floor map, Tailwind + shadcn/ui).
export default function Home() {
  return (
    <main style={{ padding: 48 }}>
      <h1>Seatline</h1>
      <p>The floor map arrives in Phase 2. Seat states: {SEAT_OCCUPANCY.join(', ')}.</p>
    </main>
  );
}
