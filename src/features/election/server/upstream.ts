import { ApiRequestError } from '@/lib/apiClient';
import type { ApiEnvelope, ElectionSummary, PaginationMeta } from '@/lib/types';
import type { GetElectionsResult } from '../api';
import { fetchAllCursorPages } from '../pagination';

export const ELECTION_LIST_PAGE_SIZE = 50;

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

export async function loadElectionListFromApi({
  apiBaseUrl,
  tenantId,
  fetchImpl = fetch,
}: {
  apiBaseUrl: string;
  tenantId: string;
  fetchImpl?: typeof fetch;
}): Promise<GetElectionsResult> {
  return fetchAllCursorPages<ElectionSummary>(
    async ({ cursor, limit }) => {
      const url = new URL('v1/elections', ensureTrailingSlash(apiBaseUrl));
      url.searchParams.set('limit', String(limit));
      if (cursor !== undefined) url.searchParams.set('cursor', cursor);
      url.searchParams.set('tenantId', tenantId);

      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const envelope = (await response.json()) as ApiEnvelope<ElectionSummary[], PaginationMeta>;

      if (!envelope.success) {
        throw new ApiRequestError(envelope.error.code, envelope.error.message, response.status);
      }

      return {
        data: envelope.data,
        meta: envelope.meta ?? { hasMore: false, nextCursor: null },
      };
    },
    { limit: ELECTION_LIST_PAGE_SIZE }
  );
}
