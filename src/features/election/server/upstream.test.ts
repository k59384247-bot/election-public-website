import { describe, expect, it, vi } from 'vitest';
import { loadElectionListFromApi } from './upstream';

describe('election list upstream loader', () => {
  it('accepts nullable optional metadata and returns safe list values', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        data: [
          {
            id: 'election-1',
            title: 'Election 1',
            description: null,
            thumbnailUrl: null,
            status: 'voting_closed',
            startDate: '2026-09-01T00:00:00.000Z',
            endDate: '2026-09-30T00:00:00.000Z',
            votesCast: null,
          },
        ],
        meta: { hasMore: false, nextCursor: null },
      })
    );

    await expect(
      loadElectionListFromApi({
        apiBaseUrl: 'https://elections.example/api',
        tenantId: 'amsul',
        fetchImpl: fetchMock,
      })
    ).resolves.toMatchObject({
      data: [
        {
          id: 'election-1',
          description: '',
          thumbnailUrl: null,
          votesCast: 0,
        },
      ],
    });
  });
});
