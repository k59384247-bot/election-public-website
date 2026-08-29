'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useElections } from '../useElections';
import type { GetElectionsResult } from '../api';
import { getElectionListModel } from '../listModel';
import { Pagination } from '@/components/Pagination';
import { ElectionCard } from './ElectionCard';
import { ElectionFilters, type SortKey, type StatusFilter } from './ElectionFilters';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingSkeleton } from './LoadingSkeleton';
import { resetPaginationScroll } from '@/lib/paginationScroll';

const RESULTS_PER_PAGE_OPTIONS = [12, 24, 48] as const;

export function ElectionList({ initialData }: { initialData?: GetElectionsResult }) {
  const { elections, isInitialLoading, isError, error, hasBackgroundError, retry } = useElections({
    initialData,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');
  const [page, setPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState<number>(RESULTS_PER_PAGE_OPTIONS[0]);

  const { visibleElections, totalPages, currentPage, pageElections } = useMemo(
    () =>
      getElectionListModel(elections, {
        searchQuery,
        statusFilter,
        sortKey,
        page,
        resultsPerPage,
      }),
    [elections, searchQuery, statusFilter, sortKey, page, resultsPerPage]
  );
  const hasMountedRef = useRef(false);

  // Protect against state changes that do not originate in Pagination (for
  // example a filter/sort update or a refreshed result set).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    resetPaginationScroll();
  }, [currentPage, resultsPerPage, searchQuery, sortKey, statusFilter]);

  // Page count depends on the filtered/sorted set, not the raw fetch, so
  // every filter/sort/page-size change resets to page 1 here (rather than
  // via an effect) — otherwise a since-cleared filter could snap back to
  // whatever page number was left over from the narrower view.
  function handleSearchQueryChange(next: string) {
    resetPaginationScroll();
    setSearchQuery(next);
    setPage(1);
  }

  function handleStatusFilterChange(next: StatusFilter) {
    resetPaginationScroll();
    setStatusFilter(next);
    setPage(1);
  }

  function handleSortKeyChange(next: SortKey) {
    resetPaginationScroll();
    setSortKey(next);
    setPage(1);
  }

  function handleResultsPerPageChange(next: number) {
    resetPaginationScroll();
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
          <div className="event-grid" data-pagination-scroll-container>
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
