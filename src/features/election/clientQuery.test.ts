import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('election list client query', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {});
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not make 30-second requests while mounted or after cached navigation', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          meta: { hasMore: false, nextCursor: null },
          refreshError: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const [{ QueryClient, QueryObserver }, { electionListQueryOptions }] = await Promise.all([
      import('@tanstack/react-query'),
      import('./clientQuery'),
    ]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const options = electionListQueryOptions('tenant-a');
    const firstObserver = new QueryObserver(client, options);
    const unsubscribeFirst = firstObserver.subscribe(() => {});

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    const navigationObserver = new QueryObserver(client, options);
    const unsubscribeNavigation = navigationObserver.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    unsubscribeNavigation();
    client.clear();
  });

  it('hydrates from the server snapshot even when this tenant has older browser data', async () => {
    const [{ QueryClient, QueryObserver }, { electionListQueryOptions, electionsQueryKey }] =
      await Promise.all([import('@tanstack/react-query'), import('./clientQuery')]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const oldSnapshot = {
      data: [
        {
          id: 'old-election',
          title: 'US Elections (Copy 3)',
          description: '',
          thumbnailUrl: 'https://images.example/old.jpg',
          status: 'voting_closed' as const,
          startDate: '2026-08-31T23:00:00.000Z',
          endDate: '2026-09-01T19:00:00.000Z',
          votesCast: 1,
        },
      ],
      meta: { hasMore: false, nextCursor: null },
    };
    const serverSnapshot = {
      data: [
        {
          id: 'new-election',
          title: 'COMPSSA Elections 2026/27 2 (Copy 2) 2',
          description: '',
          thumbnailUrl: 'https://images.example/new.jpg',
          status: 'voting_open' as const,
          startDate: '2026-09-03T08:00:00.000Z',
          endDate: '2026-09-03T18:00:00.000Z',
          votesCast: 0,
        },
      ],
      meta: { hasMore: false, nextCursor: null },
    };

    client.setQueryData(electionsQueryKey('tenant-a', 1), oldSnapshot);
    const observer = new QueryObserver(
      client,
      electionListQueryOptions('tenant-a', serverSnapshot, false, 2)
    );

    expect(observer.getCurrentResult().data?.data[0].title).toBe(
      'COMPSSA Elections 2026/27 2 (Copy 2) 2'
    );
    client.clear();
  });
});
