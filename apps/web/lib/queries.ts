'use client';

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, apiUpload } from './api';
import type {
  ActivityKind,
  ActivityPage,
  Assignment,
  AssignResult,
  BillingOverview,
  Building,
  DashboardData,
  Floor,
  PlanImport,
  FloorMap,
  HistoryEntry,
  Me,
  MovePlanDetail,
  MovePlanSummary,
  Overview,
  Person,
  Stats,
  DirectoryPerson,
  TenantInfo,
  SpacePlan,
} from './types';

export const keys = {
  me: ['me'] as const,
  buildings: ['buildings'] as const,
  floors: (buildingId: string) => ['floors', buildingId] as const,
  floorMap: (floorId: string) => ['floorMap', floorId] as const,
  people: (search: string) => ['people', search] as const,
  person: (personId: string) => ['people', 'one', personId] as const,
  seatHistory: (seatId: string) => ['seatHistory', seatId] as const,
  personHistory: (personId: string) => ['personHistory', personId] as const,
  activity: (filters: ActivityFilters) => ['activity', filters] as const,
  overview: ['overview'] as const,
  dashboard: ['dashboard'] as const,
  movePlans: (status: string) => ['movePlans', status] as const,
  movePlan: (id: string) => ['movePlan', id] as const,
  stats: ['stats'] as const,
  planning: ['planning'] as const,
};

export interface ActivityFilters {
  q?: string;
  kind?: ActivityKind;
  personId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/** The change history, newest first, 50 at a time. */
export const useActivity = (filters: ActivityFilters) =>
  useInfiniteQuery({
    queryKey: keys.activity(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams(
        Object.entries({ ...filters, cursor: pageParam ?? undefined })
          .filter((e) => !!e[1])
          .map(([k, v]) => [k, String(v)]),
      );
      return api<ActivityPage>(`/activity?${query.toString()}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });

export const useOverview = () =>
  useQuery({ queryKey: keys.overview, queryFn: () => api<Overview>('/overview') });

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<Me>('/me') });

export const useBuildings = () =>
  useQuery({ queryKey: keys.buildings, queryFn: () => api<Building[]>('/buildings') });

export const useFloors = (buildingId: string | undefined) =>
  useQuery({
    queryKey: keys.floors(buildingId ?? ''),
    queryFn: () => api<Floor[]>(`/floors?buildingId=${buildingId}`),
    enabled: !!buildingId,
  });

export const useFloorMap = (floorId: string | undefined) =>
  useQuery({
    queryKey: keys.floorMap(floorId ?? ''),
    queryFn: () => api<FloorMap>(`/floors/${floorId}/map`),
    enabled: !!floorId,
  });

export const usePeople = (search: string) =>
  useQuery({
    queryKey: keys.people(search),
    queryFn: () => api<Person[]>(`/people?search=${encodeURIComponent(search)}&limit=100`),
    placeholderData: keepPreviousData,
  });

export const usePerson = (personId: string | undefined) =>
  useQuery({
    queryKey: keys.person(personId ?? ''),
    queryFn: () => api<Person>(`/people/${personId}`),
    enabled: !!personId,
  });

export const useSeatHistory = (seatId: string | undefined) =>
  useQuery({
    queryKey: keys.seatHistory(seatId ?? ''),
    queryFn: () => api<HistoryEntry[]>(`/seats/${seatId}/history`),
    enabled: !!seatId,
  });

export const usePersonHistory = (personId: string | undefined) =>
  useQuery({
    queryKey: keys.personHistory(personId ?? ''),
    queryFn: () => api<HistoryEntry[]>(`/people/${personId}/history`),
    enabled: !!personId,
  });

/** After any seat change: refresh maps, people (their seat) and histories. */
function useInvalidateSeating() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['floorMap', 'people', 'seatHistory', 'personHistory'].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
}

export function useAssign() {
  const invalidate = useInvalidateSeating();
  return useMutation({
    mutationFn: (input: { seatId: string; personId: string; note?: string }) =>
      api<AssignResult>('/assignments', { method: 'POST', body: input }),
    onSettled: invalidate,
  });
}

export function useReserve() {
  const invalidate = useInvalidateSeating();
  return useMutation({
    mutationFn: (input: { seatId: string; reservedFor: string; note?: string }) =>
      api<Assignment>('/assignments/reservations', { method: 'POST', body: input }),
    onSettled: invalidate,
  });
}

export function useEndAssignment() {
  const invalidate = useInvalidateSeating();
  return useMutation({
    mutationFn: (input: { id: string; note?: string }) =>
      api<Assignment>(`/assignments/${input.id}/end`, {
        method: 'POST',
        body: { note: input.note },
      }),
    onSettled: invalidate,
  });
}

// ---- Buildings and floors (layout editor) -----------------------------------

function useInvalidatePlaces() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ['buildings', 'floors', 'floorMap'].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
}

export function useCreateBuilding() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (input: { name: string; address?: string }) =>
      api<Building>('/buildings', { method: 'POST', body: input }),
    onSettled: invalidate,
  });
}

export function useUpdateBuilding() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; name?: string; address?: string | null }) =>
      api<Building>(`/buildings/${id}`, { method: 'PATCH', body: input }),
    onSettled: invalidate,
  });
}

export function useDeleteBuilding() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/buildings/${id}`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

export function useCreateFloor() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (input: {
      buildingId: string;
      name: string;
      level: number;
      copyFromFloorId?: string;
    }) => api<Floor>('/floors', { method: 'POST', body: input }),
    onSettled: invalidate,
  });
}

export function useUpdateFloor() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      level?: number;
      scale?: number | null;
      deskWidth?: number | null;
      deskDepth?: number | null;
      seatNumbering?: Floor['seatNumbering'];
    }) => api<Floor>(`/floors/${id}`, { method: 'PATCH', body: input }),
    onSettled: invalidate,
  });
}

export function useDeleteFloor() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/floors/${id}`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

export function useUploadPlan() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: ({ floorId, file }: { floorId: string; file: File }) =>
      apiUpload<Floor>(`/floors/${floorId}/plan`, file),
    onSettled: invalidate,
  });
}

/** Architect plan → suggested background, rooms and desks (nothing is saved yet). */
export function useAnalyzePlan() {
  return useMutation({
    mutationFn: ({ floorId, file }: { floorId: string; file: File }) =>
      apiUpload<PlanImport>(`/floors/${floorId}/imports`, file),
  });
}

/** The import's image becomes the floor's plan (rooms and desks follow as an editor action). */
export function useApplyPlanImport() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: ({
      floorId,
      importId,
      scale,
    }: {
      floorId: string;
      importId: string;
      scale: number | null;
    }) =>
      api<Floor>(`/floors/${floorId}/imports/${importId}/apply`, {
        method: 'POST',
        body: { scale },
      }),
    onSettled: invalidate,
  });
}

export const discardPlanImport = (floorId: string, importId: string) =>
  api<void>(`/floors/${floorId}/imports/${importId}`, { method: 'DELETE' }).catch(() => {
    // best effort: a leftover image is harmless
  });

export function useRemovePlan() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (floorId: string) => api<void>(`/floors/${floorId}/plan`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

// ---- People & access (admins) ------------------------------------------------

export const useTenant = (options?: { refetchInterval?: number | false }) =>
  useQuery({
    queryKey: ['tenant'],
    queryFn: () => api<TenantInfo>('/tenant'),
    refetchInterval: options?.refetchInterval,
  });

export const useDirectory = () =>
  useQuery({ queryKey: ['directory'], queryFn: () => api<DirectoryPerson[]>('/people/directory') });

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, appRole }: { id: string; appRole: DirectoryPerson['appRole'] }) =>
      api<{ id: string; appRole: DirectoryPerson['appRole'] }>(`/people/${id}/role`, {
        method: 'PATCH',
        body: { appRole },
      }),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['directory'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]),
  });
}

export function useSetTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: { id: string } & ({ team: string | null } | { fromDirectory: true })) =>
      api<{ id: string; department: string | null }>(`/people/${id}/team`, {
        method: 'PATCH',
        body,
      }),
    // teams show up in the directory, people lists, the map's team colours and the stats
    onSettled: () => qc.invalidateQueries(),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      defaultAppRole?: TenantInfo['defaultAppRole'];
      historyRetentionMonths?: TenantInfo['historyRetentionMonths'];
      name?: string;
      notifyEmails?: string[];
      notifyEvents?: TenantInfo['notifyEvents'];
      notifyLanguage?: TenantInfo['notifyLanguage'];
      notifyPeople?: boolean;
    }) => api<TenantInfo>('/tenant', { method: 'PATCH', body: input }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['tenant'] }),
  });
}

export function useSyncNow() {
  return useMutation({
    mutationFn: () => api<{ queued: boolean }>('/people/sync', { method: 'POST' }),
  });
}

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => api<DashboardData>('/dashboard') });

export const usePlanning = () =>
  useQuery({ queryKey: keys.planning, queryFn: () => api<SpacePlan>('/planning') });

/** Set (or remove: headcount null) a team's expected headcount. */
export function useSetTeamPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { team: string; headcount: number | null; byDate?: string | null }) =>
      api<SpacePlan>('/planning/teams', { method: 'PUT', body }),
    onSuccess: (data) => qc.setQueryData(keys.planning, data),
  });
}

export const useStats = () =>
  useQuery({ queryKey: keys.stats, queryFn: () => api<Stats>('/stats') });

/** Save my layout, reset it, or (admins) save it as the company default. */
export function useDashboardActions() {
  const qc = useQueryClient();
  const done = (data: DashboardData) => qc.setQueryData(keys.dashboard, data);
  return {
    save: useMutation({
      mutationFn: (widgets: DashboardData['widgets']) =>
        api<DashboardData>('/dashboard', { method: 'PUT', body: { widgets } }),
      onSuccess: done,
    }),
    reset: useMutation({
      mutationFn: () => api<DashboardData>('/dashboard', { method: 'DELETE' }),
      onSuccess: done,
    }),
    saveDefault: useMutation({
      mutationFn: (widgets: DashboardData['widgets']) =>
        api<DashboardData>('/dashboard/default', { method: 'PUT', body: { widgets } }),
      onSuccess: done,
    }),
  };
}

export const useMovePlans = (status: 'open' | 'done') =>
  useQuery({
    queryKey: keys.movePlans(status),
    queryFn: () => api<MovePlanSummary[]>(`/move-plans?status=${status}`),
  });

export const useMovePlan = (id: string | null | undefined) =>
  useQuery({
    queryKey: keys.movePlan(id ?? ''),
    queryFn: () => api<MovePlanDetail>(`/move-plans/${id}`),
    enabled: !!id,
  });

/** Every change to a plan answers with the whole plan (moves + problems), which we keep. */
export function useMovePlanActions(id: string) {
  const qc = useQueryClient();
  const done = (plan: MovePlanDetail) => {
    qc.setQueryData(keys.movePlan(id), plan);
    void qc.invalidateQueries({ queryKey: ['movePlans'] });
  };
  const useCall = <I>(path: string, method: string, body?: (input: I) => unknown) =>
    useMutation({
      mutationFn: (input: I) =>
        api<MovePlanDetail>(`/move-plans/${id}${path}`, {
          method,
          body: body ? body(input) : undefined,
        }),
      onSuccess: done,
    });
  return {
    update: useCall<{ name?: string; note?: string | null }>('', 'PATCH', (i) => i),
    setItems: useCall<Array<{ personId: string; toSeatId: string | null }>>(
      '/items',
      'PUT',
      (items) => ({
        items,
      }),
    ),
    removeItem: useMutation({
      mutationFn: (personId: string) =>
        api<MovePlanDetail>(`/move-plans/${id}/items/${personId}`, { method: 'DELETE' }),
      onSuccess: done,
    }),
    placeTeam: useCall<{ department: string | null; floorId: string }>('/team', 'POST', (i) => i),
    schedule: useCall<string>('/schedule', 'POST', (effectiveDate) => ({ effectiveDate })),
    unschedule: useCall<void>('/unschedule', 'POST'),
    cancel: useCall<void>('/cancel', 'POST'),
    apply: useMutation({
      mutationFn: () => api<MovePlanDetail>(`/move-plans/${id}/apply`, { method: 'POST' }),
      onSuccess: (plan) => {
        done(plan);
        // people really moved: everything that shows seats is out of date
        void qc.invalidateQueries();
      },
    }),
  };
}

export function useCreateMovePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) =>
      api<MovePlanSummary>('/move-plans', { method: 'POST', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['movePlans'] }),
  });
}

/** Admins: forget a person who left (their seat history stays, unnamed). */
/** People & access changes reach everything (lists, map, stats): refresh it all. */
function usePeopleMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries() });
}

export interface NewPerson {
  displayName: string;
  email: string;
  department?: string | null;
  appRole: DirectoryPerson['appRole'];
  invite: boolean;
  language: string;
}

export const useCreatePerson = () =>
  usePeopleMutation((body: NewPerson) =>
    api<DirectoryPerson & { invited: boolean }>('/people', { method: 'POST', body }),
  );

export interface ImportRow {
  line: number;
  displayName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  problem: 'no_name' | 'bad_email' | null;
  status: 'new' | 'exists' | 'duplicate' | 'invalid';
}

/** Read a spreadsheet of people (nothing is saved yet). */
export const useReadImport = () =>
  useMutation({
    mutationFn: (file: File) => apiUpload<{ rows: ImportRow[] }>('/people/import/read', file),
  });

export const useImportPeople = () =>
  usePeopleMutation(
    (body: {
      people: Array<Pick<ImportRow, 'displayName' | 'email' | 'department' | 'jobTitle'>>;
      appRole: DirectoryPerson['appRole'];
      invite: boolean;
      language: string;
    }) =>
      api<{ created: number; skipped: number; invited: number }>('/people/import', {
        method: 'POST',
        body,
      }),
  );

export const useUpdatePerson = () =>
  usePeopleMutation(
    ({
      id,
      ...body
    }: {
      id: string;
      displayName?: string;
      email?: string;
      jobTitle?: string | null;
    }) => api<DirectoryPerson>(`/people/${id}`, { method: 'PATCH', body }),
  );

export const useSetActive = () =>
  usePeopleMutation(({ id, active }: { id: string; active: boolean }) =>
    api<DirectoryPerson>(`/people/${id}/active`, { method: 'PATCH', body: { active } }),
  );

export const useInvitePerson = () =>
  usePeopleMutation(({ id, language }: { id: string; language: string }) =>
    api<{ invited: boolean }>(`/people/${id}/invite`, { method: 'POST', body: { language } }),
  );

export interface PersonChange {
  personId: string;
  department?: string | null;
  appRole?: DirectoryPerson['appRole'];
  leavesOn?: string | null;
}

/** HR table: several people's team / role / leaving date at once. */
export const useApplyChanges = () =>
  usePeopleMutation((changes: PersonChange[]) =>
    api<{ saved: number }>('/people/changes', { method: 'POST', body: { changes } }),
  );

export const useRenameTeam = () =>
  usePeopleMutation((body: { from: string; to: string | null }) =>
    api<{ people: number }>('/people/teams/rename', { method: 'POST', body }),
  );

export function useForgetPerson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/privacy/people/${id}/forget`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries(),
  });
}

export const useBilling = (options?: { refetchInterval?: number | false }) =>
  useQuery({
    queryKey: ['billing'],
    queryFn: () => api<BillingOverview>('/billing'),
    refetchInterval: options?.refetchInterval,
  });

/** Admins: go to Stripe (checkout to subscribe, or the portal for card and invoices). */
export function useBillingRedirect() {
  return useMutation({
    mutationFn: async (to: 'checkout' | 'portal') => {
      const { url } = await api<{ url: string }>(`/billing/${to}`, {
        method: 'POST',
        body: { returnUrl: `${window.location.origin}/billing` },
      });
      window.location.assign(url);
    },
  });
}
