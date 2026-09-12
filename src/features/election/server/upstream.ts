import { ApiRequestError } from '@/lib/apiClient';
import type {
  ApiErrorCode,
  ElectionSummary,
  PaginationMeta,
  PublicElectionStatus,
} from '@/lib/types';
import type { GetElectionsResult } from '../api';
import { fetchAllCursorPages } from '../pagination';

export const ELECTION_LIST_PAGE_SIZE = 50;

const ELECTION_STATUSES = new Set<PublicElectionStatus>([
  'voting_open',
  'voting_paused',
  'voting_closed',
  'results_published',
  'upcoming',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeElectionSummary(value: unknown): ElectionSummary | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    typeof value.title !== 'string' ||
    typeof value.status !== 'string' ||
    !ELECTION_STATUSES.has(value.status as PublicElectionStatus) ||
    typeof value.startDate !== 'string' ||
    typeof value.endDate !== 'string'
  ) {
    return null;
  }

  if (
    value.description !== undefined &&
    value.description !== null &&
    typeof value.description !== 'string'
  ) {
    return null;
  }
  if (
    value.thumbnailUrl !== undefined &&
    value.thumbnailUrl !== null &&
    typeof value.thumbnailUrl !== 'string'
  ) {
    return null;
  }
  if (
    value.votesCast !== undefined &&
    value.votesCast !== null &&
    (typeof value.votesCast !== 'number' || !Number.isFinite(value.votesCast))
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === 'string' ? value.description : '',
    thumbnailUrl: typeof value.thumbnailUrl === 'string' ? value.thumbnailUrl : null,
    status: value.status as PublicElectionStatus,
    startDate: value.startDate,
    endDate: value.endDate,
    votesCast: typeof value.votesCast === 'number' ? value.votesCast : 0,
  };
}

function parsePage(value: unknown, response: Response): {
  data: ElectionSummary[];
  meta: PaginationMeta;
} {
  if (!isRecord(value) || typeof value.success !== 'boolean') {
    throw new Error('Election list API returned a malformed response');
  }

  if (!response.ok) {
    throw new Error(`Election list API returned HTTP ${response.status}`);
  }

  if (!value.success) {
    const error = isRecord(value.error) ? value.error : null;
    if (error && typeof error.code === 'string' && typeof error.message === 'string') {
      throw new ApiRequestError(error.code as ApiErrorCode, error.message, response.status);
    }
    throw new Error('Election list API returned a malformed error response');
  }

  if (!Array.isArray(value.data)) {
    throw new Error('Election list API returned malformed election data');
  }
  const data = value.data.map(normalizeElectionSummary);
  if (data.some((election): election is null => election === null)) {
    throw new Error('Election list API returned malformed election data');
  }

  const meta = value.meta;
  if (
    meta !== undefined &&
    (!isRecord(meta) ||
      typeof meta.hasMore !== 'boolean' ||
      (meta.nextCursor !== null && typeof meta.nextCursor !== 'string'))
  ) {
    throw new Error('Election list API returned malformed pagination data');
  }

  return {
    data: data as ElectionSummary[],
    meta: meta
      ? { hasMore: meta.hasMore as boolean, nextCursor: meta.nextCursor as string | null }
      : { hasMore: false, nextCursor: null },
  };
}

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
      return parsePage(await response.json(), response);
    },
    { limit: ELECTION_LIST_PAGE_SIZE }
  );
}
