'use client';

import { useQuery } from '@tanstack/react-query';
import { getElectionById } from './api';

/**
 * Full election detail (positions + candidates) for the ballot/review/
 * receipt screens. Deliberately fetched once and never refetched —
 * staleTime: Infinity means React Query will not re-request this in the
 * background on remount/focus/reconnect. The voting flow must never risk
 * resetting the ballot/review/submitting UI out from under the voter with
 * fresh data mid-transaction (build spec §11.2). Only mount whatever renders
 * this hook once the voting session has reached 'token_acquired' or later.
 *
 * VoteFlowLayout (pre-auth, identity/OTP screens) runs its own plain
 * getElectionById query under this same ['election-full', electionId] key,
 * purely to warm this cache ahead of time — this endpoint is ~1s against
 * the current staging backend, so by the time a voter reaches this hook the
 * data is often already there. That query is a separate, best-effort,
 * refetchable one; it's never THIS hook mounted early.
 */
export function useFullElection(electionId: string) {
  const query = useQuery({
    queryKey: ['election-full', electionId],
    queryFn: () => getElectionById(electionId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return {
    election: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    retry: query.refetch,
  };
}
