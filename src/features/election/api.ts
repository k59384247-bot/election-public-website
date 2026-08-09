/**
 * The ONLY module allowed to know that election summaries live at
 * GET /v1/elections. Everything else (hooks, components) goes through
 * `getElections`.
 */

import { apiRequest } from '@/lib/apiClient';
import type { Election, ElectionSummary, PaginationMeta } from '@/lib/types';

const DEFAULT_LIMIT = 12;

export interface GetElectionsParams {
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
  cursor,
  limit = DEFAULT_LIMIT,
  revalidate,
}: GetElectionsParams = {}): Promise<GetElectionsResult> {
  const { data, meta } = await apiRequest<ElectionSummary[], PaginationMeta>(
    '/v1/elections',
    {
      query: { limit, cursor },
      revalidate,
    }
  );

  return {
    data,
    meta: meta ?? { hasMore: false, nextCursor: null },
  };
}

/**
 * Full election detail — positions (each with maxVotesPerVoter) and their
 * candidates. Used by the ballot/review/receipt screens, which need data
 * `ElectionSummary` deliberately excludes.
 */
export async function getElectionById(electionId: string): Promise<Election> {
  const { data } = await apiRequest<Election>(`/v1/elections/${electionId}`);
  return data;
}
