import type { PaginationMeta } from '@/lib/types';

const DEFAULT_LIMIT = 12;
const DEFAULT_MAX_PAGES = 50;

export interface CursorPageRequest {
  cursor?: string;
  limit: number;
}

export interface CursorPage<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Exhaust a cursor-paginated endpoint into one stable list snapshot. */
export async function fetchAllCursorPages<T extends { id: string }>(
  fetchPage: (request: CursorPageRequest) => Promise<CursorPage<T>>,
  { limit = DEFAULT_LIMIT, maxPages = DEFAULT_MAX_PAGES } = {}
): Promise<CursorPage<T>> {
  const records = new Map<string, T>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await fetchPage({ cursor, limit });
    for (const record of page.data) {
      if (!records.has(record.id)) records.set(record.id, record);
    }

    if (!page.meta.hasMore) {
      return { data: [...records.values()], meta: { hasMore: false, nextCursor: null } };
    }

    const nextCursor = page.meta.nextCursor;
    if (!nextCursor) {
      throw new Error('Invalid cursor pagination: hasMore=true but nextCursor is missing');
    }
    if (seenCursors.has(nextCursor)) {
      throw new Error('Invalid cursor pagination: nextCursor did not advance');
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new Error(`Invalid cursor pagination: exceeded ${maxPages} pages`);
}
