import { describe, expect, it } from 'vitest';
import { getElectionListModel } from './listModel';
import type { ElectionSummary } from '@/lib/types';

function election(id: string, status: ElectionSummary['status']): ElectionSummary {
  return {
    id,
    title: `Election ${id}`,
    description: `Description ${id}`,
    thumbnailUrl: null,
    status,
    startDate: `2026-01-${id === 'open-1' ? '01' : '02'}T00:00:00.000Z`,
    endDate: '2026-12-31T00:00:00.000Z',
    votesCast: 0,
  };
}

const elections = [
  election('open-1', 'voting_open'),
  election('open-2', 'voting_open'),
  election('closed-1', 'voting_closed'),
  election('closed-2', 'voting_closed'),
];

const baseOptions = {
  searchQuery: '',
  statusFilter: 'all' as const,
  sortKey: 'relevance' as const,
  resultsPerPage: 2,
};

describe('getElectionListModel', () => {
  it('filters before UI pagination, so both open elections are in the filtered set', () => {
    const model = getElectionListModel(elections, {
      ...baseOptions,
      statusFilter: 'voting_open',
      page: 1,
    });

    expect(model.visibleElections.map(({ id }) => id)).toEqual(['open-1', 'open-2']);
    expect(model.pageElections.map(({ id }) => id)).toEqual(['open-1', 'open-2']);
    expect(model.totalPages).toBe(1);
  });

  it('keeps page 1 stable after navigating page 1 -> page 2 -> page 1', () => {
    const page1Before = getElectionListModel(elections, { ...baseOptions, page: 1 });
    const page2 = getElectionListModel(elections, { ...baseOptions, page: 2 });
    const page1After = getElectionListModel(elections, { ...baseOptions, page: 1 });

    expect(page2.pageElections.map(({ id }) => id)).toEqual(['closed-1', 'closed-2']);
    expect(page1After.pageElections).toEqual(page1Before.pageElections);
  });

  it('clamps to page 1 when a filter change leaves one filtered page', () => {
    const model = getElectionListModel(elections, {
      ...baseOptions,
      statusFilter: 'voting_open',
      page: 2,
    });

    expect(model.currentPage).toBe(1);
    expect(model.pageElections.map(({ id }) => id)).toEqual(['open-1', 'open-2']);
  });
});
