import type { ElectionSummary, PublicElectionStatus } from '@/lib/types';

export type ListSortKey = 'relevance' | 'newest' | 'oldest' | 'votes';
export type ListStatusFilter = PublicElectionStatus | 'all';

export interface ElectionListModelOptions {
  searchQuery: string;
  statusFilter: ListStatusFilter;
  sortKey: ListSortKey;
  page: number;
  resultsPerPage: number;
}

export interface ElectionListModel {
  visibleElections: ElectionSummary[];
  pageElections: ElectionSummary[];
  totalPages: number;
  currentPage: number;
}

function sortForDisplay(elections: ElectionSummary[], sortKey: ListSortKey): ElectionSummary[] {
  if (sortKey === 'relevance') return elections;

  const sorted = [...elections];
  switch (sortKey) {
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
  return (
    (election.title ?? '').toLowerCase().includes(needle) ||
    (election.description ?? '').toLowerCase().includes(needle)
  );
}

/** Filter/sort the complete snapshot before slicing a UI page from it. */
export function getElectionListModel(
  elections: ElectionSummary[],
  { searchQuery, statusFilter, sortKey, page, resultsPerPage }: ElectionListModelOptions
): ElectionListModel {
  const filtered = elections.filter(
    (election) =>
      matchesSearch(election, searchQuery) &&
      (statusFilter === 'all' || election.status === statusFilter)
  );
  const visibleElections = sortForDisplay(filtered, sortKey);
  const totalPages = Math.max(1, Math.ceil(visibleElections.length / resultsPerPage));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (currentPage - 1) * resultsPerPage;

  return {
    visibleElections,
    totalPages,
    currentPage,
    pageElections: visibleElections.slice(startIndex, startIndex + resultsPerPage),
  };
}
