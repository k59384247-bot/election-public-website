import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApiRequestError } from '@/lib/apiClient';
import { NETWORK_ERROR_CODE } from '@/lib/errors';

const apiRequestMock = vi.fn();

// Only apiRequest is mocked — ApiRequestError (which castVote()'s branching
// checks with `instanceof`) stays the real class from apiClient.ts.
vi.mock('@/lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/apiClient')>('@/lib/apiClient');
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  };
});

const { castVote, CastVoteNetworkError } = await import('./api');

const ELECTION_ID = 'election-1';
const VOTES = [{ positionId: 'pos-1', candidateId: 'cand-1' }];
const ID_TOKEN = 'firebase-id-token';

function networkError() {
  return new ApiRequestError(NETWORK_ERROR_CODE, 'Unable to reach the server');
}

describe('castVote', () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it('clean success: resolves with the receipt code from a single request', async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: { message: 'ok', receiptCode: 'AMSUL-27-8AF39D' },
    });

    const result = await castVote(ELECTION_ID, VOTES, ID_TOKEN);

    expect(result).toEqual({ success: true, receiptCode: 'AMSUL-27-8AF39D', alreadyVoted: false });
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledWith(
      '/v1/elections/cast-vote',
      expect.objectContaining({
        method: 'POST',
        token: ID_TOKEN,
        body: { electionId: ELECTION_ID, votes: VOTES },
      })
    );
  });

  it('timeout-then-success: retries exactly once after a NETWORK_ERROR and returns the retry\'s receipt code', async () => {
    apiRequestMock
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce({ data: { message: 'ok', receiptCode: 'AMSUL-27-RETRY1' } });

    const result = await castVote(ELECTION_ID, VOTES, ID_TOKEN);

    expect(result).toEqual({ success: true, receiptCode: 'AMSUL-27-RETRY1', alreadyVoted: false });
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('timeout-then-ALREADY_VOTED: treats the retry\'s ALREADY_VOTED as success, not an error', async () => {
    apiRequestMock
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(new ApiRequestError('ALREADY_VOTED', 'You have already voted'));

    const result = await castVote(ELECTION_ID, VOTES, ID_TOKEN);

    expect(result).toEqual({ success: true, receiptCode: null, alreadyVoted: true });
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('ALREADY_VOTED on the very first attempt (no prior NETWORK_ERROR) is also treated as success', async () => {
    apiRequestMock.mockRejectedValueOnce(new ApiRequestError('ALREADY_VOTED', 'You have already voted'));

    const result = await castVote(ELECTION_ID, VOTES, ID_TOKEN);

    expect(result).toEqual({ success: true, receiptCode: null, alreadyVoted: true });
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('a genuine ELECTION_CLOSED rejection is thrown as-is and never retried', async () => {
    const rejection = new ApiRequestError('ELECTION_CLOSED', 'Voting is not currently open');
    apiRequestMock.mockRejectedValueOnce(rejection);

    await expect(castVote(ELECTION_ID, VOTES, ID_TOKEN)).rejects.toBe(rejection);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('other definitive rejections (e.g. FORBIDDEN) are also thrown as-is and never retried', async () => {
    const rejection = new ApiRequestError('FORBIDDEN', 'Not allowed');
    apiRequestMock.mockRejectedValueOnce(rejection);

    await expect(castVote(ELECTION_ID, VOTES, ID_TOKEN)).rejects.toBe(rejection);
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry also gets no response: throws CastVoteNetworkError, still only 2 attempts total', async () => {
    apiRequestMock.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError());

    await expect(castVote(ELECTION_ID, VOTES, ID_TOKEN)).rejects.toBeInstanceOf(CastVoteNetworkError);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it('a genuine rejection surfacing on the retry itself is thrown as-is', async () => {
    apiRequestMock
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(new ApiRequestError('ELECTION_CLOSED', 'Voting is not currently open'));

    await expect(castVote(ELECTION_ID, VOTES, ID_TOKEN)).rejects.toMatchObject({ code: 'ELECTION_CLOSED' });
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });
});
