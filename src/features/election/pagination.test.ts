import { describe, expect, it } from 'vitest';
import { fetchAllCursorPages } from './pagination';
import type { ElectionSummary } from '@/lib/types';

function election(id: string, status: ElectionSummary['status'] = 'voting_open'): ElectionSummary {
  return {
    id,
    title: `Election ${id}`,
    description: `Description ${id}`,
    thumbnailUrl: null,
    status,
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    votesCast: 0,
  };
}

describe('fetchAllCursorPages', () => {
  it('follows nextCursor and returns records from later API pages', async () => {
    const requests: Array<{ cursor?: string; limit: number }> = [];
    const pages = new Map<string | undefined, { data: ElectionSummary[]; meta: { hasMore: boolean; nextCursor: string | null } }>([
      [undefined, { data: [election('open-1')], meta: { hasMore: true, nextCursor: 'page-2' } }],
      ['page-2', { data: [election('open-2')], meta: { hasMore: false, nextCursor: null } }],
    ]);

    const result = await fetchAllCursorPages<ElectionSummary>(async ({ cursor, limit }) => {
      requests.push({ cursor, limit });
      return pages.get(cursor)!;
    });

    expect(result.data.map(({ id }) => id)).toEqual(['open-1', 'open-2']);
    expect(requests).toEqual([
      { cursor: undefined, limit: 12 },
      { cursor: 'page-2', limit: 12 },
    ]);
    expect(result.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  it('does not request another page when hasMore is false', async () => {
    let requestCount = 0;

    const result = await fetchAllCursorPages<ElectionSummary>(async () => {
      requestCount += 1;
      return { data: [election('only')], meta: { hasMore: false, nextCursor: 'ignored' } };
    });

    expect(requestCount).toBe(1);
    expect(result.meta).toEqual({ hasMore: false, nextCursor: null });
  });

  it('rejects a hasMore response that cannot advance the cursor', async () => {
    await expect(
      fetchAllCursorPages<ElectionSummary>(async () => ({
        data: [election('broken')],
        meta: { hasMore: true, nextCursor: null },
      }))
    ).rejects.toThrow('hasMore=true but nextCursor is missing');
  });
});
