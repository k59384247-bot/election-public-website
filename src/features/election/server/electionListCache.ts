import type { GetElectionsResult } from '../api';

export interface ElectionListCacheResult {
  data: GetElectionsResult;
  version: number;
  isStale: boolean;
  refreshError: Error | null;
}

type ElectionListLoader = (apiBaseUrl: string, tenantId: string) => Promise<GetElectionsResult>;

export const ELECTION_LIST_FRESH_MS = 300_000;
export const ELECTION_LIST_STALE_MS = 900_000;

interface CacheEntry {
  data: GetElectionsResult;
  loadedAt: number;
  refreshError: Error | null;
  refreshPromise?: Promise<void>;
  retryPromise?: Promise<GetElectionsResult>;
  nextRefreshAt: number;
}

function cacheKey(apiBaseUrl: string, tenantId: string): string {
  return JSON.stringify([apiBaseUrl, tenantId]);
}

export function createElectionListCache({
  load,
  schedule,
}: {
  load: ElectionListLoader;
  schedule?: (task: Promise<void>) => void;
}) {
  const entries = new Map<string, CacheEntry>();
  const misses = new Map<string, Promise<CacheEntry>>();

  function loadMiss(apiBaseUrl: string, tenantId: string, key: string): Promise<CacheEntry> {
    let pending = misses.get(key);
    if (!pending) {
      pending = load(apiBaseUrl, tenantId).then((data) => {
        const loadedAt = Date.now();
        const entry: CacheEntry = {
          data,
          loadedAt,
          refreshError: null,
          nextRefreshAt: loadedAt + ELECTION_LIST_FRESH_MS,
        };
        entries.set(key, entry);
        return entry;
      });
      misses.set(key, pending);
      pending.finally(() => misses.delete(key)).catch(() => {});
    }
    return pending;
  }

  function refresh(apiBaseUrl: string, tenantId: string, entry: CacheEntry): void {
    if (entry.refreshPromise || Date.now() < entry.nextRefreshAt) return;

    entry.nextRefreshAt = Date.now() + ELECTION_LIST_FRESH_MS;
    entry.refreshPromise = load(apiBaseUrl, tenantId)
      .then((data) => {
        const loadedAt = Date.now();
        entry.data = data;
        entry.loadedAt = loadedAt;
        entry.refreshError = null;
        entry.nextRefreshAt = loadedAt + ELECTION_LIST_FRESH_MS;
      })
      .catch((error: unknown) => {
        entry.refreshError = error instanceof Error ? error : new Error('Election list refresh failed');
      })
      .finally(() => {
        entry.refreshPromise = undefined;
      });
    schedule?.(entry.refreshPromise);
  }

  return {
    async get(apiBaseUrl: string, tenantId: string): Promise<ElectionListCacheResult> {
      const key = cacheKey(apiBaseUrl, tenantId);
      let entry = entries.get(key);
      if (!entry) {
        entry = await loadMiss(apiBaseUrl, tenantId, key);
      }

      const age = Date.now() - entry.loadedAt;
      if (age < ELECTION_LIST_FRESH_MS) {
        return { data: entry.data, version: entry.loadedAt, isStale: false, refreshError: null };
      }

      if (age <= ELECTION_LIST_FRESH_MS + ELECTION_LIST_STALE_MS) {
        refresh(apiBaseUrl, tenantId, entry);
        return {
          data: entry.data,
          version: entry.loadedAt,
          isStale: true,
          refreshError: entry.refreshError,
        };
      }

      entries.delete(key);
      entry = await loadMiss(apiBaseUrl, tenantId, key);
      return { data: entry.data, version: entry.loadedAt, isStale: false, refreshError: null };
    },

    async retry(apiBaseUrl: string, tenantId: string): Promise<ElectionListCacheResult> {
      const key = cacheKey(apiBaseUrl, tenantId);
      const entry = entries.get(key);
      if (!entry) return this.get(apiBaseUrl, tenantId);

      if (entry.refreshPromise) await entry.refreshPromise;
      if (!entry.refreshError && Date.now() - entry.loadedAt < ELECTION_LIST_FRESH_MS) {
        return { data: entry.data, version: entry.loadedAt, isStale: false, refreshError: null };
      }

      if (!entry.retryPromise) {
        entry.retryPromise = load(apiBaseUrl, tenantId)
          .then((data) => {
            const loadedAt = Date.now();
            entry.data = data;
            entry.loadedAt = loadedAt;
            entry.refreshError = null;
            entry.nextRefreshAt = loadedAt + ELECTION_LIST_FRESH_MS;
            return data;
          })
          .finally(() => {
            entry.retryPromise = undefined;
          });
      }

      const data = await entry.retryPromise;
      return { data, version: entry.loadedAt, isStale: false, refreshError: null };
    },
  };
}
