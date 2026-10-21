/** A drawn Seatline floor for the landing page (no real data; colours follow the theme). */
type Desk = { x: number; y: number; s: 'free' | 'taken' | 'reserved'; label?: string };

const ROWS: [number, Desk['s'][], string[]][] = [
  [120, ['taken', 'taken', 'free', 'taken'], ['AK', 'MD', '', 'LS']],
  [162, ['taken', 'reserved', 'taken', 'free'], ['TB', 'R', 'JM', '']],
  [232, ['free', 'taken', 'taken', 'taken'], ['', 'NR', 'CF', 'PW']],
];

const DESKS: Desk[] = [
  // open space: three rows of four
  ...ROWS.flatMap(([y, states, labels]) =>
    states.map((s, i) => ({ x: 40 + i * 52, y, s, label: labels[i] })),
  ),
  // offices
  { x: 300, y: 64, s: 'taken', label: 'SG' },
  { x: 392, y: 64, s: 'free' },
  { x: 300, y: 174, s: 'reserved', label: 'R' },
];

export function FloorIllustration({
  label,
  floor,
  cardSince,
}: {
  label: string;
  floor: string;
  cardSince: string;
}) {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border bg-background shadow-xl shadow-black/5">
        <div className="flex items-center gap-1.5 border-b bg-canvas px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          <span className="ml-3 text-xs text-muted-foreground">{floor}</span>
        </div>
        <svg
          role="img"
          aria-label={label}
          viewBox="0 0 470 300"
          className="block w-full bg-canvas/40"
        >
          <g fill="none" stroke="var(--border)" strokeWidth="2">
            <rect x="12" y="12" width="446" height="276" rx="6" fill="var(--background)" />
            <rect x="276" y="12" width="92" height="104" />
            <rect x="368" y="12" width="90" height="104" />
            <rect x="276" y="140" width="92" height="104" />
            <rect x="368" y="140" width="90" height="148" />
            <rect x="24" y="100" width="232" height="100" rx="4" strokeDasharray="4 4" />
            <rect x="24" y="212" width="232" height="64" rx="4" strokeDasharray="4 4" />
          </g>
          {/* meeting room table */}
          <rect x="386" y="190" width="54" height="56" rx="10" fill="var(--muted)" />
          {DESKS.map((d, i) => (
            <g key={i}>
              <rect
                x={d.x}
                y={d.y}
                width="40"
                height="30"
                rx="6"
                fill={`var(--seat-${d.s}-fill)`}
                stroke={`var(--seat-${d.s}-stroke)`}
                strokeWidth="1.5"
              />
              {d.label && (
                <text
                  x={d.x + 20}
                  y={d.y + 19.5}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={`var(--seat-${d.s}-text)`}
                >
                  {d.label}
                </text>
              )}
            </g>
          ))}
          {/* the selected desk */}
          <rect
            x="88"
            y="228"
            width="48"
            height="38"
            rx="9"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2.5"
          />
        </svg>
      </div>
      <div className="absolute -bottom-5 left-6 flex items-center gap-3 rounded-xl border bg-background px-4 py-3 shadow-lg sm:left-auto sm:-right-4">
        <span className="grid size-9 place-items-center rounded-full bg-[var(--seat-taken-fill)] text-sm font-semibold text-[var(--seat-taken-text)]">
          NR
        </span>
        <span className="grid text-sm leading-tight">
          <span className="font-medium">Nina Roth</span>
          <span className="text-muted-foreground">{cardSince}</span>
        </span>
      </div>
    </div>
  );
}
