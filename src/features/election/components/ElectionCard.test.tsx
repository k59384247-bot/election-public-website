// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ElectionSummary } from '@/lib/types';

vi.mock('@/features/tenant/TenantContext', () => ({
  useTenant: () => ({ tenantId: 'tenant-a' }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ prefetchQuery: vi.fn() }),
}));

const { ElectionCard } = await import('./ElectionCard');

function election(status: ElectionSummary['status']): ElectionSummary {
  return {
    id: 'election-1',
    title: 'Student Election',
    description: 'Elect student representatives.',
    thumbnailUrl: null,
    status,
    startDate: '2026-09-12T08:00:00.000Z',
    endDate: '2026-09-12T17:00:00.000Z',
    votesCast: 0,
  };
}

describe('ElectionCard navigation', () => {
  afterEach(cleanup);

  it.each([
    'voting_open',
    'upcoming',
    'voting_paused',
    'voting_closed',
    'results_published',
  ] satisfies ElectionSummary['status'][])(
    'links the full %s card to its vote page',
    (status) => {
      render(<ElectionCard election={election(status)} />);

      const link = screen.getByRole('link', { name: 'Open Student Election' });
      expect(link.getAttribute('href')).toBe('/tenant-a/elections/election-1/vote');
      expect(link.classList.contains('event-card__link')).toBe(true);
    }
  );
});
