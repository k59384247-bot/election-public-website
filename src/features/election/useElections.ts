'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, type Query } from '@tanstack/react-query';
import { getElections, type GetElectionsResult } from './api';
import type { ElectionSummary, PublicElectionStatus } from '@/lib/types';

const DEFAULT_PAGE_SIZE = 12;
export const RESULTS_PER_PAGE_OPTIONS = [12, 24, 48] as const;
const POLL_INTERVAL_IDLE_MS = 60_000;
const POLL_INTERVAL_ACTIVE_MS = 25_000;

export const PAGE1_QUERY_KEY = ['elections', 'page1'] as const;

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
 * Page 1 is always authoritative for the ids it currently returns — a
 * background refetch simply replaces `page1` wholesale (handled by React
 * Query itself). Pages loaded via loadMore() are kept in separate state so
 * they survive that refetch; we only dedupe here in case an id now also
 * appears in the fresh page-1 response.
 */
function mergeById(
  page1: ElectionSummary[],
  additionalPages: ElectionSummary[]
): ElectionSummary[] {
  const page1Ids = new Set(page1.map((election) => election.id));
  return [...page1, ...additionalPages.filter((election) => !page1Ids.has(election.id))];
}

export interface UseElectionsOptions {
  /** Seed data from the server-rendered initial fetch in app/page.tsx. */
  initialData?: GetElectionsResult;
}

export function useElections({ initialData }: UseElectionsOptions = {}) {
  const [additionalPages, setAdditionalPages] = useState<ElectionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialData?.meta.nextCursor ?? null
  );
  const [hasMore, setHasMore] = useState<boolean>(initialData?.meta.hasMore ?? false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const [resultsPerPage, setResultsPerPage] = useState(DEFAULT_PAGE_SIZE);

  // react-query evaluates `refetchInterval` outside the render cycle, so a
  // plain closure over `additionalPages` would see a stale empty array.
  const additionalPagesRef = useRef<ElectionSummary[]>(additionalPages);
  additionalPagesRef.current = additionalPages;

  // Read synchronously (not from the `resultsPerPage` state closure) so a
  // page-size change can force-refetch with the new limit in the same tick
  // it's set, rather than one render behind.
  const resultsPerPageRef = useRef(resultsPerPage);
  resultsPerPageRef.current = resultsPerPage;

  const page1Query = useQuery({
    queryKey: PAGE1_QUERY_KEY,
    queryFn: () => getElections({ limit: resultsPerPageRef.current }),
    initialData,
    // Without this, staleTime defaults to 0 and refetchOnMount fires a
    // client fetch the instant ElectionList mounts — which can resolve and
    // setState while React is still hydrating, producing a hydration
    // mismatch even when `initialData` and the SSR HTML agree. A few
    // seconds of grace lets hydration finish before the first background
    // refetch; refetchInterval below still keeps the list live afterward.
    staleTime: 5_000,
    refetchIntervalInBackground: false,
    refetchInterval: (query: Query<GetElectionsResult, Error>) => {
      const page1Elections = query.state.data?.data ?? [];
      const loaded = mergeById(page1Elections, additionalPagesRef.current);
      if (loaded.length === 0) return false;
      return hasOpenVoting(loaded) ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS;
    },
  });

  const page1Data = page1Query.data?.data ?? [];

  // Seed/refresh the loadMore cursor from page 1 only while the user hasn't
  // paginated yet. Once additionalPages is non-empty, a background page-1
  // refetch must not reset how far the user has scrolled (build spec §7.1).
  useEffect(() => {
    if (!page1Query.data) return;
    if (additionalPages.length > 0) return;
    setNextCursor(page1Query.data.meta.nextCursor);
    setHasMore(page1Query.data.meta.hasMore);
  }, [page1Query.data, additionalPages.length]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !nextCursor) return;

    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await getElections({ cursor: nextCursor, limit: resultsPerPageRef.current });
      setAdditionalPages((current) => [...current, ...result.data]);
      setNextCursor(result.meta.nextCursor);
      setHasMore(result.meta.hasMore);
    } catch (err) {
      setLoadMoreError(err instanceof Error ? err : new Error('Failed to load more elections'));
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, nextCursor]);

  // Changing page size starts over from a fresh page 1 at the new limit —
  // the pages already scrolled past no longer line up with the new batch
  // size, so there's nothing sensible to preserve from `additionalPages`.
  const changeResultsPerPage = useCallback(
    (nextSize: number) => {
      if (nextSize === resultsPerPageRef.current) return;
      resultsPerPageRef.current = nextSize;
      setResultsPerPage(nextSize);
      setAdditionalPages([]);
      setLoadMoreError(null);
      page1Query.refetch();
    },
    [page1Query]
  );

  const elections = sortByStatus(mergeById(page1Data, additionalPages));

  return {
    elections,
    hasMore,
    loadMore,
    isLoadingMore,
    loadMoreError,
    resultsPerPage,
    changeResultsPerPage,
    /** True only for the very first page-1 fetch — never for background polls. */
    isInitialLoading: page1Query.isLoading,
    isError: page1Query.isError && elections.length === 0,
    error: page1Query.error,
    retry: page1Query.refetch,
  };
}
