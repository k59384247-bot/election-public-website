'use client';

import { useMemo, useState } from 'react';
import { useElections } from '../useElections';
import type { GetElectionsResult } from '../api';
import type { ElectionSummary } from '@/lib/types';
import { Pagination } from '@/components/Pagination';
import { ElectionCard } from './ElectionCard';
import { ElectionFilters, type SortKey, type StatusFilter } from './ElectionFilters';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingSkeleton } from './LoadingSkeleton';

const RESULTS_PER_PAGE_OPTIONS = [12, 24, 48] as const;

// Sort applied on top of whatever's currently loaded (useElections already
// orders `elections` by status priority — 'relevance' just keeps that).
// This is a client-side convenience layer, not a server query: the API only
// takes cursor/limit, so search/status/sort never leave the browser.
function sortForDisplay(elections: ElectionSummary[], sortKey: SortKey): ElectionSummary[] {
  if (sortKey === 'relevance') return elections;

  const sorted = [...elections];
  switch (sortKey) {
    // startDate is typed non-nullable but, like title/description above,
    // has been observed null from the live API — guard the same way.
    case 'newest':
      sorted.sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
      break;
    case 'oldest':
      sorted.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
      break;
    case 'votes':
      sorted.sort((a, b) => b.votesCast - a.votesCast);
      break;
  }
  return sorted;
}

function matchesSearch(election: ElectionSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  // ElectionSummary types title/description as non-nullable, but the live
  // API has been observed sending null for these — guard defensively rather
  // than trust the type, since a search keystroke should never crash the page.
  return (
    (election.title ?? '').toLowerCase().includes(needle) ||
    (election.description ?? '').toLowerCase().includes(needle)
  );
}

export function ElectionList({ initialData }: { initialData?: GetElectionsResult }) {
  const { elections, isInitialLoading, isError, error, hasBackgroundError, retry } = useElections({
    initialData,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [page, setPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState<number>(RESULTS_PER_PAGE_OPTIONS[0]);

  const visibleElections = useMemo(() => {
    const filtered = elections.filter(
      (election) =>
        matchesSearch(election, searchQuery) &&
        (statusFilter === 'all' || election.status === statusFilter)
    );
    return sortForDisplay(filtered, sortKey);
  }, [elections, searchQuery, statusFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(visibleElections.length / resultsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * resultsPerPage;
  const pageElections = visibleElections.slice(startIndex, startIndex + resultsPerPage);

  // Page count depends on the filtered/sorted set, not the raw fetch, so
  // every filter/sort/page-size change resets to page 1 here (rather than
  // via an effect) — otherwise a since-cleared filter could snap back to
  // whatever page number was left over from the narrower view.
  function handleSearchQueryChange(next: string) {
    setSearchQuery(next);
    setPage(1);
  }

  function handleStatusFilterChange(next: StatusFilter) {
    setStatusFilter(next);
    setPage(1);
  }

  function handleSortKeyChange(next: SortKey) {
    setSortKey(next);
    setPage(1);
  }

  function handleResultsPerPageChange(next: number) {
    setResultsPerPage(next);
    setPage(1);
  }

  if (isInitialLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => retry()} />;
  }

  if (elections.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      <ElectionFilters
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        sortKey={sortKey}
        onSortKeyChange={handleSortKeyChange}
      />

      {visibleElections.length === 0 ? (
        <div className="elections-notice">
          <h2 className="elections-notice__title">No matching elections</h2>
          <p className="elections-notice__text">
            Try a different search term or status filter.
          </p>
        </div>
      ) : (
        <>
          <div className="event-grid">
            {pageElections.map((election) => (
              <ElectionCard key={election.id} election={election} />
            ))}
          </div>

          <div className="elections-pagination">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              perPageId="elections-per-page-select"
              perPageLabel="Results per page"
              perPageValue={resultsPerPage}
              perPageOptions={RESULTS_PER_PAGE_OPTIONS}
              onPerPageChange={handleResultsPerPageChange}
              ariaLabel="Elections pages"
            />
          </div>
        </>
      )}

      {hasBackgroundError && (
        <p className="elections-notice__text" role="alert">
          Couldn&apos;t refresh the elections list.{' '}
          <button type="button" onClick={() => retry()}>
            Retry
          </button>
        </p>
      )}
    </>
  );
}
