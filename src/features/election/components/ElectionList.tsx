'use client';

import { useMemo, useState } from 'react';
import { useElections, RESULTS_PER_PAGE_OPTIONS } from '../useElections';
import type { GetElectionsResult } from '../api';
import type { ElectionSummary } from '@/lib/types';
import { PerPageSelect } from '@/components/PerPageSelect';
import { ElectionCard } from './ElectionCard';
import { ElectionFilters, type SortKey, type StatusFilter } from './ElectionFilters';
import { LoadMoreButton } from './LoadMoreButton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { LoadingSkeleton } from './LoadingSkeleton';

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
  const {
    elections,
    hasMore,
    loadMore,
    isLoadingMore,
    loadMoreError,
    resultsPerPage,
    changeResultsPerPage,
    isInitialLoading,
    isError,
    error,
    retry,
  } = useElections({ initialData });

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('relevance');

  const visibleElections = useMemo(() => {
    const filtered = elections.filter(
      (election) =>
        matchesSearch(election, searchQuery) &&
        (statusFilter === 'all' || election.status === statusFilter)
    );
    return sortForDisplay(filtered, sortKey);
  }, [elections, searchQuery, statusFilter, sortKey]);

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
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
      />

      {visibleElections.length === 0 ? (
        <div className="elections-notice">
          <h2 className="elections-notice__title">No matching elections</h2>
          <p className="elections-notice__text">
            Try a different search term or status filter.
          </p>
        </div>
      ) : (
        <div className="event-grid">
          {visibleElections.map((election) => (
            <ElectionCard key={election.id} election={election} />
          ))}
        </div>
      )}

      <div className="elections-per-page">
        <PerPageSelect
          id="elections-per-page-select"
          label="Results per page"
          value={resultsPerPage}
          options={RESULTS_PER_PAGE_OPTIONS}
          onChange={changeResultsPerPage}
        />
      </div>

      {hasMore && <LoadMoreButton onClick={loadMore} isLoading={isLoadingMore} />}
      {loadMoreError && (
        <p className="elections-notice__text" role="alert">
          Couldn&apos;t load more elections. Please try again.
        </p>
      )}
    </>
  );
}
