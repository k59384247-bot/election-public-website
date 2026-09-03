import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectionSummary } from '@/lib/types';
import { createElectionListCache } from './electionListCache';
import { loadElectionListFromApi } from './upstream';

function election(id: string): ElectionSummary {
  return {
    id,
    title: `Election ${id}`,
    description: `Description ${id}`,
    thumbnailUrl: null,
    status: 'voting_open',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    votesCast: 0,
  };
}

function apiPage(ids: string[], hasMore: boolean, nextCursor: string | null) {
  return new Response(
    JSON.stringify({
      success: true,
      data: ids.map(election),
      meta: { hasMore, nextCursor },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

describe('election list server cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('performs one complete traversal on initial load', async () => {
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(apiPage(['1', '2'], true, 'v1.opaque.cursor'))
      .mockResolvedValueOnce(apiPage(['3'], false, null));
    const traversal = vi.fn((apiBaseUrl: string, tenantId: string) =>
      loadElectionListFromApi({ apiBaseUrl, tenantId, fetchImpl: upstreamFetch })
    );
    const cache = createElectionListCache({ load: traversal });

    const result = await cache.get('https://elections.example/api/', 'tenant-a');

    expect(result.data.data.map(({ id }) => id)).toEqual(['1', '2', '3']);
    expect(traversal).toHaveBeenCalledTimes(1);
    expect(upstreamFetch).toHaveBeenCalledTimes(2);
  });

  it('loads more than 50 elections with the opaque nextCursor unchanged', async () => {
    const firstPageIds = Array.from({ length: 50 }, (_, index) => String(index + 1));
    const versionedCursor = 'v2.eyJkb2N1bWVudElkIjoiNTАifQ==.signature';
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(apiPage(firstPageIds, true, versionedCursor))
      .mockResolvedValueOnce(apiPage(['51', '52'], false, null));
    const cache = createElectionListCache({
      load: (apiBaseUrl, tenantId) =>
        loadElectionListFromApi({ apiBaseUrl, tenantId, fetchImpl: upstreamFetch }),
    });

    const result = await cache.get('https://elections.example/api/', 'tenant-a');
    const requestedUrls = upstreamFetch.mock.calls.map(([input]) => new URL(String(input)));

    expect(result.data.data.map(({ id }) => id)).toEqual([...firstPageIds, '51', '52']);
    expect(new Set(result.data.data.map(({ id }) => id)).size).toBe(52);
    expect(requestedUrls.map((url) => url.searchParams.get('limit'))).toEqual(['50', '50']);
    expect(requestedUrls[1].searchParams.get('cursor')).toBe(versionedCursor);
  });

  it('starts one refresh when the five-minute freshness window expires', async () => {
    const traversal = vi
      .fn()
      .mockResolvedValueOnce({
        data: [election('old')],
        meta: { hasMore: false, nextCursor: null },
      })
      .mockResolvedValueOnce({
        data: [election('new')],
        meta: { hasMore: false, nextCursor: null },
      });
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    vi.advanceTimersByTime(300_000);
    const duringRefresh = await cache.get('https://elections.example/api', 'tenant-a');
    await vi.waitFor(() => expect(traversal).toHaveBeenCalledTimes(2));

    expect(duringRefresh.data.data.map(({ id }) => id)).toEqual(['old']);
  });

  it('reuses data for re-renders and navigation during the freshness window', async () => {
    const traversal = vi.fn().mockResolvedValue({
      data: [election('one')],
      meta: { hasMore: false, nextCursor: null },
    });
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    vi.advanceTimersByTime(299_999);
    await cache.get('https://elections.example/api', 'tenant-a');
    await cache.get('https://elections.example/api', 'tenant-a');

    expect(traversal).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent cold misses into one traversal', async () => {
    let finish!: (result: { data: ElectionSummary[]; meta: { hasMore: false; nextCursor: null } }) => void;
    const traversal = vi.fn(
      () =>
        new Promise<{ data: ElectionSummary[]; meta: { hasMore: false; nextCursor: null } }>(
          (resolve) => {
            finish = resolve;
          }
        )
    );
    const cache = createElectionListCache({ load: traversal });

    const first = cache.get('https://elections.example/api', 'tenant-a');
    const second = cache.get('https://elections.example/api', 'tenant-a');
    finish({ data: [election('one')], meta: { hasMore: false, nextCursor: null } });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(traversal).toHaveBeenCalledTimes(1);
  });

  it('cannot collide cache entries for different tenants', async () => {
    const traversal = vi.fn(async (_apiBaseUrl: string, tenantId: string) => ({
      data: [election(tenantId)],
      meta: { hasMore: false as const, nextCursor: null },
    }));
    const cache = createElectionListCache({ load: traversal });

    const [tenantA, tenantB] = await Promise.all([
      cache.get('https://elections.example/api', 'tenant-a'),
      cache.get('https://elections.example/api', 'tenant-b'),
    ]);

    expect(tenantA.data.data.map(({ id }) => id)).toEqual(['tenant-a']);
    expect(tenantB.data.data.map(({ id }) => id)).toEqual(['tenant-b']);
    expect(traversal).toHaveBeenCalledTimes(2);
  });

  it('serves the last valid list when a refresh fails and never fabricates an empty list', async () => {
    const traversal = vi
      .fn()
      .mockResolvedValueOnce({
        data: [election('still-valid')],
        meta: { hasMore: false, nextCursor: null },
      })
      .mockRejectedValueOnce(new Error('upstream unavailable'));
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    vi.advanceTimersByTime(300_000);
    await cache.get('https://elections.example/api', 'tenant-a');
    await Promise.resolve();
    await Promise.resolve();
    const stale = await cache.get('https://elections.example/api', 'tenant-a');

    expect(stale.data.data.map(({ id }) => id)).toEqual(['still-valid']);
    expect(stale.isStale).toBe(true);
    expect(stale.refreshError?.message).toBe('upstream unavailable');
  });

  it('allows an explicit retry to replace stale data after a refresh error', async () => {
    const traversal = vi
      .fn()
      .mockResolvedValueOnce({
        data: [election('old')],
        meta: { hasMore: false, nextCursor: null },
      })
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({
        data: [election('new')],
        meta: { hasMore: false, nextCursor: null },
      });
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    vi.advanceTimersByTime(300_000);
    await cache.get('https://elections.example/api', 'tenant-a');
    await Promise.resolve();
    await Promise.resolve();
    const retried = await cache.retry('https://elections.example/api', 'tenant-a');

    expect(retried.data.data.map(({ id }) => id)).toEqual(['new']);
    expect(retried.refreshError).toBeNull();
  });

  it('makes no timed requests while a page is idle', async () => {
    const traversal = vi.fn().mockResolvedValue({
      data: [election('one')],
      meta: { hasMore: false, nextCursor: null },
    });
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    vi.advanceTimersByTime(600_000);

    expect(traversal).toHaveBeenCalledTimes(1);
  });

  it('reduces a ten-minute 30-second navigation simulation from 21 traversals to 3', async () => {
    const traversal = vi.fn().mockResolvedValue({
      data: [election('one')],
      meta: { hasMore: false, nextCursor: null },
    });
    const cache = createElectionListCache({ load: traversal });

    await cache.get('https://elections.example/api', 'tenant-a');
    for (let request = 0; request < 20; request += 1) {
      vi.advanceTimersByTime(30_000);
      await cache.get('https://elections.example/api', 'tenant-a');
      await Promise.resolve();
    }

    expect(traversal).toHaveBeenCalledTimes(3);
  });
});
