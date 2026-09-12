import 'server-only';

import { createHash } from 'node:crypto';
import { revalidateTag, unstable_cache } from 'next/cache';
import { after } from 'next/server';
import { createElectionListCache, ELECTION_LIST_FRESH_MS } from './electionListCache';
import { loadElectionListFromApi } from './upstream';

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  return new URL(configured.endsWith('/') ? configured : `${configured}/`).toString();
}

export function electionListCacheTag(baseUrl: string, tenantId: string): string {
  const digest = createHash('sha256').update(`${baseUrl}\u0000${tenantId}`).digest('hex');
  return `election-list:${digest}`;
}

interface CachedElectionSnapshot {
  data: Awaited<ReturnType<typeof loadElectionListFromApi>>;
  loadedAt: number;
}

function loadCachedGeneration(baseUrl: string, tenantId: string, generation: number) {
  // generation is deliberately part of the framework cache key. It advances
  // once per freshness window and is never interpreted by the upstream API.
  const load = unstable_cache(
    async (): Promise<CachedElectionSnapshot> => ({
      data: await loadElectionListFromApi({ apiBaseUrl: baseUrl, tenantId }),
      loadedAt: Date.now(),
    }),
    ['complete-election-list-v2', baseUrl, tenantId, String(generation)],
    {
      revalidate: ELECTION_LIST_FRESH_MS / 1_000,
      tags: [electionListCacheTag(baseUrl, tenantId)],
    }
  );
  return load();
}

const electionListCache = createElectionListCache({
  load: async (baseUrl, tenantId) =>
    (await loadCachedGeneration(baseUrl, tenantId, Math.floor(Date.now() / ELECTION_LIST_FRESH_MS))).data,
  schedule: (task) => after(() => task),
});

export async function getCachedElectionList(tenantId: string) {
  const baseUrl = apiBaseUrl();
  try {
    const snapshot = await loadCachedGeneration(
      baseUrl,
      tenantId,
      Math.floor(Date.now() / ELECTION_LIST_FRESH_MS)
    );
    electionListCache.seed(baseUrl, tenantId, snapshot.data, snapshot.loadedAt);
  } catch {
    // If a shared-cache revalidation fails, the process-local snapshot still
    // provides the permitted stale-while-revalidate fallback and its existing
    // non-blocking error state.
  }
  return electionListCache.get(baseUrl, tenantId);
}

export async function retryCachedElectionList(tenantId: string) {
  const baseUrl = apiBaseUrl();
  revalidateTag(electionListCacheTag(baseUrl, tenantId), { expire: 0 });
  return electionListCache.refreshNow(baseUrl, tenantId);
}

/**
 * Expire and immediately rebuild one tenant's list after a trusted dashboard
 * mutation. The local snapshot is refreshed too, while refresh failures leave
 * the previous valid snapshot available to the normal stale fallback path.
 */
export async function invalidateAndPrewarmElectionList(tenantId: string) {
  const baseUrl = apiBaseUrl();
  revalidateTag(electionListCacheTag(baseUrl, tenantId), { expire: 0 });
  return electionListCache.refreshNow(baseUrl, tenantId);
}
