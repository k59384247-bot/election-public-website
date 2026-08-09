'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getElections, type GetElectionsResult } from './api';
import { PAGE1_QUERY_KEY } from './useElections';

/**
 * Single election lookup for the vote flow's hero. There's no dedicated
 * single-election endpoint needed here — every field the hero shows
 * (title/description/status/dates) already exists on ElectionSummary, which
 * the elections list (Phase 2) already fetched and cached. Reuses that
 * cache first; only falls back to a network call (the list endpoint again,
 * not a separate one) for a direct URL visit/bookmark/refresh that skipped
 * the elections list entirely.
 */
export function useElection(electionId: string) {
  const queryClient = useQueryClient();

  const cachedSummary = useMemo(() => {
    const cached = queryClient.getQueryData<GetElectionsResult>(PAGE1_QUERY_KEY);
    return cached?.data.find((election) => election.id === electionId);
  }, [queryClient, electionId]);

  const listQuery = useQuery({
    queryKey: ['election-lookup', electionId],
    queryFn: async () => {
      const { data } = await getElections({ limit: 50 });
      return data.find((election) => election.id === electionId);
    },
    enabled: cachedSummary === undefined,
  });

  return {
    election: cachedSummary ?? listQuery.data,
    isLoading: cachedSummary === undefined && listQuery.isLoading,
    isError: cachedSummary === undefined && listQuery.isError,
    error: listQuery.error,
    retry: listQuery.refetch,
  };
}
