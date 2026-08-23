'use client';

import { useMemo } from 'react';
import { useQuery, type Query } from '@tanstack/react-query';
import { getElections, type GetElectionsResult } from './api';
import type { ElectionSummary, PublicElectionStatus } from '@/lib/types';
import { useTenant } from '@/features/tenant/TenantContext';

const POLL_INTERVAL_IDLE_MS = 60_000;
const POLL_INTERVAL_ACTIVE_MS = 25_000;

// Batch size while looping the cursor to build the complete list (not a
// user-facing page size — see ElectionList for that). The list endpoint has
// no total-count/offset support, so a large batch keeps the loop short.
const FETCH_BATCH_SIZE = 50;

// Safety valve: if the API ever misreports hasMore and never terminates,
// stop after this many requests rather than looping forever.
const MAX_FETCH_PAGES = 50;

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

/**
 * Loops the cursor to completion and returns every election as one flat
 * list. Elections are few (tens, not thousands), so paying for the full
 * list up front is cheap and lets the home page use real page-number
 * navigation (Build spec §7.1 mock) instead of a Load More button — the
 * list endpoint itself still only exposes cursor pagination, this just
 * exhausts it internally rather than exposing it to the UI.
 */
async function fetchAllElections(tenantId: string): Promise<GetElectionsResult> {
  let cursor: string | undefined;
  let all: ElectionSummary[] = [];

  for (let page = 0; page < MAX_FETCH_PAGES; page += 1) {
    const { data, meta } = await getElections({ tenantId, cursor, limit: FETCH_BATCH_SIZE });
    all = all.concat(data);
    if (!meta.hasMore || !meta.nextCursor) {
      return { data: all, meta: { hasMore: false, nextCursor: null } };
    }
    cursor = meta.nextCursor;
  }

  console.error('[useElections] Stopped after', MAX_FETCH_PAGES, 'pages — API may not be terminating hasMore.');
  return { data: all, meta: { hasMore: false, nextCursor: null } };
}

export interface UseElectionsOptions {
  /** Seed data from the server-rendered initial fetch in app/page.tsx. */
  initialData?: GetElectionsResult;
}

export function useElections({ initialData }: UseElectionsOptions = {}) {
  const { tenantId } = useTenant();
  const query = useQuery({
    queryKey: electionsQueryKey(tenantId),
    queryFn: () => fetchAllElections(tenantId),
    initialData,
    // Without this, staleTime defaults to 0 and refetchOnMount fires a
    // client fetch the instant ElectionList mounts — which can resolve and
    // setState while React is still hydrating, producing a hydration
    // mismatch even when `initialData` and the SSR HTML agree. A few
    // seconds of grace lets hydration finish before the first background
    // refetch (which also completes the full list beyond initialData's
    // single SSR page); refetchInterval below keeps it live afterward.
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
