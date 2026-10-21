'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiUpload } from './api';
import type {
  Assignment,
  AssignResult,
  Building,
  Floor,
  FloorMap,
  HistoryEntry,
  Me,
  Person,
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
};

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
    mutationFn: (input: { buildingId: string; name: string; level: number }) =>
      api<Floor>('/floors', { method: 'POST', body: input }),
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

export function useRemovePlan() {
  const invalidate = useInvalidatePlaces();
  return useMutation({
    mutationFn: (floorId: string) => api<void>(`/floors/${floorId}/plan`, { method: 'DELETE' }),
    onSettled: invalidate,
  });
}
