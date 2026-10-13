// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Election, ElectionResults } from '@/lib/types';

const api = vi.hoisted(() => ({ detail: vi.fn(), results: vi.fn(), download: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ tenantId: 'amsul', electionId: 'e1' }) }));
vi.mock('@/features/tenant/TenantContext', () => ({ useTenant: () => ({ tenantId: 'amsul' }) }));
vi.mock('@/features/election/api', () => ({ getElectionById: api.detail, getElectionResults: api.results, getElectionReportDownload: api.download }));
vi.mock('@/features/voting/components/VotePageShell', () => ({ VotePageShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/features/voting/components/ElectionHead', () => ({ ElectionHead: ({ showVoterDetails }: { showVoterDetails: boolean }) => <h1>{showVoterDetails ? 'Voter details' : 'Published election'}</h1> }));
const { PublicResultsPage } = await import('./PublicResultsPage');
const election = { id: 'e1', status: 'results_published', positions: [] } as unknown as Election;
const result: ElectionResults = { electionId: 'e1', title: 'Election', totalVotesCast: 100, positions: [], report: { status: 'ready', filename: 'results.pdf', bytes: 204172 } };
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  render(<QueryClientProvider client={client}><PublicResultsPage /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks(); api.detail.mockResolvedValue(election); api.results.mockResolvedValue(result);
  api.download.mockResolvedValue({ downloadUrl: 'https://storage.googleapis.com/example/results.pdf?signature=test', filename: 'results.pdf', bytes: 204172 });
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.restoreAllMocks(); });
describe('anonymous public results and optional PDF', () => {
  it('never requests a report URL before the visitor clicks Download', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mount();
    const button = await screen.findByRole('button', { name: /Download results PDF/ });
    expect(api.results).toHaveBeenCalledWith('amsul', 'e1');
    expect(api.download).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled();
    expect(screen.queryByText('Voter details')).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(api.download).toHaveBeenCalledExactlyOnceWith('amsul', 'e1'));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
  });
  it('does not read counts or request a PDF before publication', async () => {
    api.detail.mockResolvedValue({ ...election, status: 'voting_closed' });
    mount(); await screen.findByRole('heading', { name: 'Results awaiting publication' });
    expect(api.results).not.toHaveBeenCalled(); expect(api.download).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull();
  });
  it('keeps aggregate results visible when PDF generation failed', async () => {
    api.results.mockResolvedValue({ ...result, report: { status: 'failed', filename: null, bytes: null } });
    mount(); await screen.findByText(/The PDF is currently unavailable/);
    expect(screen.getByText('100')).toBeTruthy(); expect(screen.getByText('MEET YOUR ELECTED TEAM')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Download/ })).toBeNull(); expect(api.download).not.toHaveBeenCalled();
  });
});
