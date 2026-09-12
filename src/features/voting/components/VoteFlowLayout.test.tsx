// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Election, ElectionSummary, TenantPublicInfo } from '@/lib/types';

const electionSummary: ElectionSummary = {
  id: 'election-1',
  title: 'Student Election',
  description: 'Elect student representatives.',
  thumbnailUrl: null,
  status: 'voting_closed',
  startDate: '2026-09-12T08:00:00.000Z',
  endDate: '2026-09-12T17:00:00.000Z',
  votesCast: 0,
};

const staleOpenDetail: Election = {
  ...electionSummary,
  status: 'voting_open',
  contactEmail: null,
  contactWhatsapp: null,
  contactPhone: null,
  positions: [],
};

const tenant: TenantPublicInfo = {
  id: 'tenant-id',
  tenantId: 'tenant-a',
  name: 'Tenant A',
  logoUrl: null,
  primaryColor: null,
  description: null,
  organizationType: 'student',
};

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: staleOpenDetail }),
}));

vi.mock('@/features/election/useElection', () => ({
  useElection: () => ({ election: electionSummary }),
}));

vi.mock('@/features/tenant/TenantContext', () => ({
  useTenant: () => ({ tenantId: 'tenant-a', tenant }),
}));

vi.mock('@/features/tenant/components/TenantLogo', () => ({
  TenantLogo: ({ className }: { className?: string }) => (
    <span className={className}>Tenant logo</span>
  ),
}));

vi.mock('./AssistanceCard', () => ({
  AssistanceCard: () => <section>Assistance</section>,
}));

const { VoteFlowLayout } = await import('./VoteFlowLayout');

describe('VoteFlowLayout election status', () => {
  afterEach(cleanup);

  it('locks the form when a fresh closed status is newer than stale open detail data', () => {
    render(
      <VoteFlowLayout electionId="election-1">
        <button type="button">Continue</button>
      </VoteFlowLayout>
    );

    expect(screen.getByRole('heading', { name: 'This election has ended' })).toBeTruthy();
    expect(screen.getByText('VOTING CLOSED')).toBeTruthy();
  });
});
