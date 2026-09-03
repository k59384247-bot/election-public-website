import { queryOptions } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/apiClient';
import type { GetElectionsResult } from './api';

export interface ElectionListQueryData extends GetElectionsResult {
  cacheVersion?: number;
  refreshError?: boolean;
}

export function electionsQueryPrefix(tenantId: string) {
  return ['elections', tenantId, 'all'] as const;
}

export function electionsQueryKey(tenantId: string, cacheVersion?: number) {
  return [...electionsQueryPrefix(tenantId), cacheVersion ?? 'unseeded'] as const;
}

async function fetchElectionList(tenantId: string): Promise<ElectionListQueryData> {
  const query = new URLSearchParams({ tenantId, retry: '1' });
  const response = await fetch(`/api/elections?${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiRequestError('NETWORK_ERROR', 'Unable to load elections', response.status);
  }

  return response.json() as Promise<ElectionListQueryData>;
}

export function electionListQueryOptions(
  tenantId: string,
  initialData?: GetElectionsResult,
  initialRefreshError = false,
  initialCacheVersion?: number
) {
  return queryOptions({
    queryKey: electionsQueryKey(tenantId, initialCacheVersion),
    queryFn: () => fetchElectionList(tenantId),
    initialData: initialData
      ? { ...initialData, refreshError: initialRefreshError }
      : undefined,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });
}
