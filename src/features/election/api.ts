/**
 * The ONLY module allowed to know that election summaries live at
 * GET /v1/elections. Everything else (hooks, components) goes through
 * `getElections` or the complete-snapshot helper below.
 */

import { apiRequest } from '@/lib/apiClient';
import type { Election, ElectionSummary, PaginationMeta } from '@/lib/types';
import { fetchAllCursorPages } from './pagination';

const DEFAULT_LIMIT = 12;

export interface GetElectionsParams {
  tenantId: string;
  cursor?: string;
  limit?: number;
  /** Forwarded to apiRequest for ISR on the initial server-rendered fetch. */
  revalidate?: number;
}

export interface GetElectionsResult {
  data: ElectionSummary[];
  meta: PaginationMeta;
}

export async function getElections({
  tenantId,
  cursor,
  limit = DEFAULT_LIMIT,
  revalidate,
}: GetElectionsParams): Promise<GetElectionsResult> {
  const { data, meta } = await apiRequest<ElectionSummary[], PaginationMeta>(
    '/v1/elections',
    {
      query: { limit, cursor },
      tenantId,
      revalidate,
    }
  );

  return {
    data,
    meta: meta ?? { hasMore: false, nextCursor: null },
  };
}

/** Fetch a complete list snapshot by following the API cursor. */
export async function getAllElections({
  tenantId,
  limit,
  revalidate,
}: {
  tenantId: string;
  /** API page size used while building the complete snapshot. */
  limit?: number;
  revalidate?: number;
}): Promise<GetElectionsResult> {
  return fetchAllCursorPages(
    ({ cursor, limit: pageLimit }) =>
      getElections({ tenantId, cursor, limit: pageLimit, revalidate }),
    { limit }
  );
}

/**
 * Full election detail — positions (each with maxVotesPerVoter) and their
 * candidates. Used by the ballot/review/receipt screens, which need data
 * `ElectionSummary` deliberately excludes.
 */
export async function getElectionById(tenantId: string, electionId: string): Promise<Election> {
  const { data } = await apiRequest<Election>(`/v1/elections/${encodeURIComponent(electionId)}`, {
    tenantId,
  });
  return data;
}
