'use client';

import { SEAT_OCCUPANCY } from '@seatline/shared';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ColorBy } from '@/lib/use-map-colors-mode';
import type { Seat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StatusDot } from './status-dot';

/** Key for the map's colours. A team (or '' for "no department") can be highlighted. */
export interface TeamEntry {
  name: string;
  slot: number | undefined;
  count: number;
}

/** Teams sitting on these seats: coloured teams first (by colour), then the others by name. */
export function teamsOnFloor(seats: Seat[], slots: Map<string, number>): TeamEntry[] {
  const counts = new Map<string, number>();
  for (const s of seats)
    if (s.occupancy === 'taken') {
      const name = s.currentAssignment?.person?.department ?? '';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  return [...counts]
    .map(([name, count]) => ({ name, count, slot: slots.get(name) }))
    .sort(
      (a, b) =>
        (a.slot ?? 99) - (b.slot ?? 99) ||
        Number(a.name === '') - Number(b.name === '') ||
        a.name.localeCompare(b.name),
    );
}

export function MapLegend({
  seats,
  colorBy,
  onColorBy,
  teams,
  focusTeam,
  onFocusTeam,
  className,
}: {
  seats: Seat[];
  colorBy: ColorBy;
  onColorBy: (c: ColorBy) => void;
  teams: TeamEntry[];
  focusTeam: string | null;
  onFocusTeam: (team: string | null) => void;
  className?: string;
}) {
  const t = useTranslations();
  const count = (s: (typeof SEAT_OCCUPANCY)[number]) =>
    seats.filter((x) => x.occupancy === s).length;
  return (
    <div
      className={cn(
        'flex max-h-40 flex-wrap items-center gap-x-3 gap-y-1 overflow-y-auto rounded-lg border bg-background/95 px-2 py-1.5 text-xs text-muted-foreground shadow-sm',
        className,
      )}
      data-testid="map-legend"
    >
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        aria-label={t('map.colorBy')}
        value={colorBy}
        onValueChange={(v) => v && onColorBy(v as ColorBy)}
        className="h-7"
      >
        <ToggleGroupItem value="status" className="h-7 px-2 text-xs">
          {t('map.byStatus')}
        </ToggleGroupItem>
        <ToggleGroupItem value="team" className="h-7 px-2 text-xs">
          {t('map.byTeam')}
        </ToggleGroupItem>
      </ToggleGroup>
      {colorBy === 'status' ? (
        <ul className="contents">
          {SEAT_OCCUPANCY.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <StatusDot status={s} />
              <span>
                {t(`status.${s}`)} <span className="tabular-nums text-foreground">{count(s)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : teams.length === 0 ? (
        <span>{t('map.noTeams')}</span>
      ) : (
        <ul className="contents" aria-label={t('map.teams')}>
          {teams.map((team) => {
            const label = team.name || t('map.noDepartment');
            const pressed = focusTeam === team.name;
            return (
              <li key={team.name}>
                <button
                  type="button"
                  aria-pressed={pressed}
                  title={pressed ? t('map.showAllTeams') : t('map.focusTeam', { team: label })}
                  onClick={() => onFocusTeam(pressed ? null : team.name)}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted',
                    pressed && 'bg-muted text-foreground ring-1 ring-ring',
                    focusTeam !== null && !pressed && 'opacity-60',
                  )}
                >
                  <span
                    aria-hidden
                    className="inline-block size-2.5 shrink-0 rounded-full border"
                    style={{
                      background: team.slot ? `var(--team-${team.slot})` : 'var(--seat-taken-fill)',
                      borderColor: team.slot
                        ? `var(--team-${team.slot})`
                        : 'var(--seat-taken-stroke)',
                    }}
                  />
                  {label} <span className="tabular-nums text-foreground">{team.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
