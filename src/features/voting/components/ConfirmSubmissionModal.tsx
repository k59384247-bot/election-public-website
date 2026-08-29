'use client';

import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { ApiRequestError } from '@/lib/apiClient';
import type { CastVoteEntry } from '@/lib/types';
import { useVotingSession } from '../VotingSessionContext';
import { castVote } from '../api';
import { clearBallotDraft, type BallotDraft } from '../useBallotDraft';

function draftToVotes(draft: BallotDraft): CastVoteEntry[] {
  const votes: CastVoteEntry[] = [];
  for (const [positionId, candidateIds] of Object.entries(draft.selections)) {
    for (const candidateId of candidateIds) {
      votes.push({ positionId, candidateId });
    }
  }
  return votes;
}

/**
 * Screen 7 (Confirm Submission Modal). Confirming here is the ONLY trigger
 * for the actual cast-vote call in the whole app — VoteReviewPage never
 * calls the API directly.
 */
export function ConfirmSubmissionModal({
  electionId,
  draft,
  onCancel,
}: {
  electionId: string;
  draft: BallotDraft;
  onCancel: () => void;
}) {
  const { dispatch, getFreshIdToken } = useVotingSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    // Guards a double-tap landing before the SUBMIT_VOTE-triggered re-render
    // (which swaps this modal out for the 'submitting' step view) flushes.
    if (isSubmitting) return;
    setIsSubmitting(true);

    dispatch({ type: 'SUBMIT_VOTE' });

    // Mint a fresh ID token at submit time rather than reusing the one
    // captured back at OTP verification — that frozen token can be past
    // Firebase's 1-hour expiry by now, and cast-vote rejects an expired
    // token with a 401.
    let idToken: string;
    try {
      idToken = await getFreshIdToken();
    } catch {
      // No live auth session (unreachable on the normal path) — fail loud
      // instead of sending an unauthenticated request.
      clearBallotDraft(electionId);
      dispatch({ type: 'CAST_VOTE_FAILURE', reason: 'network' });
      return;
    }

    try {
      const result = await castVote(electionId, draftToVotes(draft), idToken);
      // TEMP vote-debug — remove once the submit-hang is diagnosed.
      console.log('[vote-debug] castVote resolved', result);
      clearBallotDraft(electionId);
      dispatch({
        type: 'CAST_VOTE_SUCCESS',
        receiptCode: result.receiptCode,
        alreadyVoted: result.alreadyVoted,
        submittedAt: new Date().toISOString(),
      });
    } catch (err) {
      // TEMP vote-debug — remove once the submit-hang is diagnosed.
      console.log('[vote-debug] castVote threw', err);
      clearBallotDraft(electionId);
      // A definitive ApiRequestError (ELECTION_CLOSED, FORBIDDEN, malformed
      // ballot codes, …) — build spec §9.3 step (e). CastVoteNetworkError
      // (or anything else) means castVote() gave up after its own retry
      // with no response at all.
      const reason = err instanceof ApiRequestError ? 'election_state' : 'network';
      dispatch({ type: 'CAST_VOTE_FAILURE', reason });
    }
  }

  return (
    <div
      className="modal"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <div
        className="modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-modal-title"
        aria-describedby="submit-modal-desc"
      >
        <button
          className="modal__close"
          type="button"
          aria-label="Close dialog"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          <X className="modal__close-icon" style={{ color: 'var(--color-neutral-800)' }} aria-hidden="true" />
        </button>

        <div className="modal__head">
          <h2 className="modal__title" id="submit-modal-title">
            Confirm Submission
          </h2>
          <p className="modal__desc" id="submit-modal-desc">
            You are about to submit your ballot.
            <br />
            After submission, you will not be able to edit your selections.
          </p>
        </div>

        <div className="modal__actions">
          <button
            className="modal__btn modal__btn--secondary"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <ArrowRight
              className="modal__btn-icon modal__btn-icon--back"
              style={{ color: 'var(--color-neutral-900)' }}
              aria-hidden="true"
            />
            Go Back
          </button>
          <button className="modal__btn modal__btn--gold" type="button" onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit Vote'}
            <ArrowRight className="modal__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
