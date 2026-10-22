/** Space planning, pure (unit-tested): teams' people now and expected vs the desks there are. */

export interface PlanInput {
  /** active people with their team and whether they have a desk now */
  people: Array<{ department: string | null; seated: boolean }>;
  /** every seat: status, whether someone has it (or it's reserved), its floor and room's team zone */
  seats: Array<{
    status: 'active' | 'blocked';
    open: 'assigned' | 'reserved' | null;
    floorId: string;
    zone: string | null;
  }>;
  floors: Array<{ id: string; name: string; building: string }>;
  plans: Array<{ team: string; headcount: number; byDate: string | null }>;
}

export interface TeamRow {
  /** null = people without a team */
  name: string | null;
  people: number;
  seated: number;
  /** planned headcount (null = no plan: stays as it is) */
  target: number | null;
  byDate: string | null;
  /** desks the team still needs: expected people − people with a desk */
  needed: number;
  /** desks in this team's zone(s), and how many of them are free */
  zoneDesks: number;
  zoneFree: number;
}

export function spacePlan(input: PlanInput) {
  const free = (s: PlanInput['seats'][number]) => s.status === 'active' && !s.open;
  const teams = new Map<string, TeamRow>();
  const row = (name: string | null) => {
    const key = name ?? '';
    let r = teams.get(key);
    if (!r) {
      const plan = name ? input.plans.find((p) => p.team === name) : undefined;
      r = {
        name,
        people: 0,
        seated: 0,
        target: plan?.headcount ?? null,
        byDate: plan?.byDate ?? null,
        needed: 0,
        zoneDesks: 0,
        zoneFree: 0,
      };
      teams.set(key, r);
    }
    return r;
  };
  for (const p of input.people) {
    const r = row(p.department);
    r.people += 1;
    if (p.seated) r.seated += 1;
  }
  // teams that only exist in a plan (a new team) or as a zone
  for (const p of input.plans) row(p.team);
  for (const s of input.seats)
    if (s.zone && s.status === 'active') {
      const r = row(s.zone);
      r.zoneDesks += 1;
      if (free(s)) r.zoneFree += 1;
    }
  for (const r of teams.values()) r.needed = Math.max(0, (r.target ?? r.people) - r.seated);

  const active = input.seats.filter((s) => s.status === 'active');
  const desks = {
    total: active.length,
    free: active.filter(free).length,
    taken: active.filter((s) => s.open === 'assigned').length,
    reserved: active.filter((s) => s.open === 'reserved').length,
    blocked: input.seats.length - active.length,
  };
  const rows = [...teams.values()].sort(
    (a, b) =>
      (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0) ||
      b.people - a.people ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  );
  const needed = rows.reduce((n, r) => n + r.needed, 0);
  const growth = rows.reduce((n, r) => n + Math.max(0, (r.target ?? r.people) - r.people), 0);
  return {
    desks,
    /** people who will need a desk (unseated now + expected growth) */
    needed,
    growth,
    /** desks missing once everyone expected has one (0 = enough) */
    short: Math.max(0, needed - desks.free),
    floors: input.floors.map((f) => {
      const on = active.filter((s) => s.floorId === f.id);
      return { ...f, desks: on.length, free: on.filter(free).length };
    }),
    teams: rows,
  };
}
