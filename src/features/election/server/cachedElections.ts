import 'server-only';

import { unstable_cache } from 'next/cache';
import { after } from 'next/server';
import { createElectionListCache, ELECTION_LIST_FRESH_MS } from './electionListCache';
import { loadElectionListFromApi } from './upstream';

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  return new URL(configured.endsWith('/') ? configured : `${configured}/`).toString();
}

const loadCachedGeneration = unstable_cache(
  async (baseUrl: string, tenantId: string, generation: number) => {
    // generation is deliberately part of the framework cache key. It advances
    // once per freshness window and is never interpreted by the upstream API.
    void generation;
    return loadElectionListFromApi({ apiBaseUrl: baseUrl, tenantId });
  },
  ['complete-election-list-v1'],
  { revalidate: ELECTION_LIST_FRESH_MS / 1_000 }
);

const electionListCache = createElectionListCache({
  load: (baseUrl, tenantId) =>
    loadCachedGeneration(baseUrl, tenantId, Math.floor(Date.now() / ELECTION_LIST_FRESH_MS)),
  schedule: (task) => after(() => task),
});

export function getCachedElectionList(tenantId: string) {
  return electionListCache.get(apiBaseUrl(), tenantId);
}

export function retryCachedElectionList(tenantId: string) {
  return electionListCache.retry(apiBaseUrl(), tenantId);
}
