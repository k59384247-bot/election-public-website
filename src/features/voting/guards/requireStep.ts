'use client';

import { useEffect } from 'react';
import { useVotingSession } from '../VotingSessionContext';
import type { VotingStep } from '../votingSessionReducer';

/**
 * Enforces that the calling step component only renders while the reducer's
 * actual step is one of `allowedSteps`. A stale bookmark or a refresh that
 * leaves the session past the identity form without a valid step simply
 * resets back to idle (step 1) rather than rendering broken UI. Since the
 * whole vote flow is one route, this governs which step COMPONENT renders,
 * not which Next.js route loads.
 */
export function useRequireStep(allowedSteps: readonly VotingStep[]): boolean {
  const { state, reset } = useVotingSession();
  const satisfied = allowedSteps.includes(state.step);

  useEffect(() => {
    if (!satisfied) {
      reset();
    }
  }, [satisfied, reset]);

  return satisfied;
}
