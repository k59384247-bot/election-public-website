'use client';

import { useMemo } from 'react';
import { useQuery, type Query } from '@tanstack/react-query';
import { getAllElections, type GetElectionsResult } from './api';
import type { ElectionSummary, PublicElectionStatus } from '@/lib/types';
import { useTenant } from '@/features/tenant/TenantContext';

const POLL_INTERVAL_IDLE_MS = 60_000;
const POLL_INTERVAL_ACTIVE_MS = 25_000;

export function electionsQueryKey(tenantId: string) {
  return ['elections', tenantId, 'all'] as const;
}

// The API returns elections in its own (creation-order) sequence, with no
// notion of "open elections matter more" — sort client-side so a closed
// election never visually outranks one voters can currently act on.
const STATUS_PRIORITY: Record<PublicElectionStatus, number> = {
  voting_open: 0,
  voting_paused: 1,
  upcoming: 2,
  voting_closed: 3,
  results_published: 4,
};

// Within a status, "soonest first" reads naturally for open/upcoming
// elections but backwards for ones that are already over — there, voters
// want the one that ended most recently, not the oldest one alphabetically
// first by date. So finished statuses sort by endDate descending; everything
// else sorts by startDate ascending.
const REVERSE_CHRONOLOGICAL_STATUSES = new Set<PublicElectionStatus>([
  'voting_closed',
  'results_published',
]);

function tiebreakDate(election: ElectionSummary): string {
  return REVERSE_CHRONOLOGICAL_STATUSES.has(election.status)
    ? election.endDate
    : election.startDate;
}

function sortByStatus(elections: ElectionSummary[]): ElectionSummary[] {
  return [...elections].sort((a, b) => {
    const priorityDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (priorityDiff !== 0) return priorityDiff;

    const dateDiff = tiebreakDate(a).localeCompare(tiebreakDate(b));
    return REVERSE_CHRONOLOGICAL_STATUSES.has(a.status) ? -dateDiff : dateDiff;
  });
}

function hasOpenVoting(elections: ElectionSummary[]): boolean {
  return elections.some((election) => election.status === 'voting_open');
}

export interface UseElectionsOptions {
  /** Seed data from the server-rendered initial fetch in app/page.tsx. */
  initialData?: GetElectionsResult;
}

export function useElections({ initialData }: UseElectionsOptions = {}) {
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: electionsQueryKey(tenantId),
    queryFn: () => getAllElections({ tenantId }),
    initialData,
    // Without this, staleTime defaults to 0 and refetchOnMount fires a
    // client fetch the instant ElectionList mounts — which can resolve and
    // setState while React is still hydrating, producing a hydration
    // mismatch even when `initialData` and the SSR HTML agree. A few
    // seconds of grace lets hydration finish before the first background
    // refetch; refetchInterval below keeps the complete snapshot live
    // afterward.
    staleTime: 5_000,
    refetchIntervalInBackground: false,
    refetchInterval: (query: Query<GetElectionsResult, Error>) => {
      const loaded = query.state.data?.data ?? [];
      if (loaded.length === 0) return false;
      return hasOpenVoting(loaded) ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS;
    },
  });

  const elections = useMemo(() => sortByStatus(query.data?.data ?? []), [query.data]);

  return {
    elections,
    /** True only for the very first fetch — never for background polls. */
    isInitialLoading: query.isLoading,
    isError: query.isError && elections.length === 0,
    error: query.error,
    /** A background refetch failed but earlier data is still on screen. */
    hasBackgroundError: query.isError && elections.length > 0,
    retry: query.refetch,
  };
}
