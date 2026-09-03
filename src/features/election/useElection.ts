'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllElections, type GetElectionsResult } from './api';
import { electionsQueryPrefix } from './clientQuery';
import { useTenant } from '@/features/tenant/TenantContext';

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
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const cachedSummary = useMemo(() => {
    const snapshots = queryClient.getQueriesData<GetElectionsResult>({
      queryKey: electionsQueryPrefix(tenantId),
    });
    for (let index = snapshots.length - 1; index >= 0; index -= 1) {
      const summary = snapshots[index][1]?.data.find((election) => election.id === electionId);
      if (summary) return summary;
    }
    return undefined;
  }, [queryClient, tenantId, electionId]);

  const listQuery = useQuery({
    queryKey: ['election-lookup', tenantId, electionId],
    queryFn: async () => {
      const { data } = await getAllElections({ tenantId });
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
