'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import './vote.css';
import { useVotingSession } from '@/features/voting/VotingSessionContext';
import { useRequireStep } from '@/features/voting/guards/requireStep';
import { useFullElection } from '@/features/election/useFullElection';
import { useBallotDraft } from '@/features/voting/useBallotDraft';
import { VoteFlowLayout } from '@/features/voting/components/VoteFlowLayout';
import { VerifyIdentityForm } from '@/features/voting/components/VerifyIdentityForm';
import { OtpEntryForm } from '@/features/voting/components/OtpEntryForm';
import { VotePageShell } from '@/features/voting/components/VotePageShell';
import { MainVotingPage } from '@/features/voting/components/MainVotingPage';
import { VoteReviewPage } from '@/features/voting/components/VoteReviewPage';
import { ConfirmSubmissionModal } from '@/features/voting/components/ConfirmSubmissionModal';
import { VoteSuccessPage, RejectedElectionState } from '@/features/voting/components/VoteSuccessPage';

const BALLOT_STEPS = [
  'token_acquired',
  'ballot_in_progress',
  'submitting',
  'voted',
  'rejected_election_state',
] as const;

/** Neutral "still working" state for 'submitting' — must read as "checking," not "broken" (build spec §11.2), especially across castVote()'s retry window. */
function SubmittingState() {
  return (
    <section className="card status-card" aria-live="polite" aria-busy="true">
      <h2 className="card__title">Confirming your vote…</h2>
      <p className="status-card__subtitle">
        We&apos;re submitting your ballot. This can take a few seconds — please don&apos;t close this page.
      </p>
    </section>
  );
}

function BallotLoading({ isError, retry }: { isError: boolean; retry: () => void }) {
  return (
    <section className="card status-card" aria-live="polite" aria-busy={!isError}>
      <h2 className="card__title">{isError ? 'Could not load the ballot' : 'Loading your ballot…'}</h2>
      {isError && (
        <>
          <p className="status-card__subtitle">Please check your connection and try again.</p>
          <button className="btn btn--gold" type="button" onClick={retry}>
            Retry
          </button>
        </>
      )}
    </section>
  );
}

/**
 * Covers the 'token_acquired' through 'rejected_election_state' steps
 * (screens 4-8). 'ballot_in_progress' renders either MainVotingPage or
 * VoteReviewPage depending on a purely presentational `isReviewing` flag —
 * both are the same reducer step per build spec §7.0, so this flag doesn't
 * need to live in the session reducer.
 */
function BallotFlow({ electionId }: { electionId: string }) {
  useRequireStep(BALLOT_STEPS);
  const { state, dispatch: sessionDispatch } = useVotingSession();
  const { election, isLoading, isError, retry } = useFullElection(electionId);
  const { draft, dispatch } = useBallotDraft(electionId);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Advance token_acquired -> ballot_in_progress once the ballot flow is
  // actually showing. Without this the session stays in token_acquired, which
  // makes the later SUBMIT_VOTE and CAST_VOTE_SUCCESS transitions no-ops
  // (both are guarded on ballot_in_progress / submitting), so a cast vote
  // never advances the UI past the confirm modal even though it succeeds
  // server-side. There is no distinct token_acquired screen — the ballot
  // renders for both steps — so this transition is pure plumbing.
  useEffect(() => {
    if (state.step === 'token_acquired') {
      sessionDispatch({ type: 'PROCEED_TO_BALLOT' });
    }
  }, [state.step, sessionDispatch]);

  // TEMP vote-debug — remove once the submit-hang is diagnosed.
  console.log(
    '[vote-debug] step=%s hasElection=%s isLoading=%s isError=%s',
    state.step,
    Boolean(election),
    isLoading,
    isError
  );

  let content;

  if (state.step === 'submitting') {
    content = <SubmittingState />;
  } else if (state.step === 'voted') {
    content = election ? <VoteSuccessPage election={election} /> : <SubmittingState />;
  } else if (state.step === 'rejected_election_state') {
    content = <RejectedElectionState />;
  } else if (isLoading || !election) {
    content = <BallotLoading isError={isError} retry={retry} />;
  } else if (isReviewing) {
    content = (
      <>
        <VoteReviewPage
          election={election}
          draft={draft}
          onEdit={() => setIsReviewing(false)}
          onSubmit={() => setIsModalOpen(true)}
        />
        {isModalOpen && (
          <ConfirmSubmissionModal
            electionId={electionId}
            draft={draft}
            onCancel={() => setIsModalOpen(false)}
          />
        )}
      </>
    );
  } else {
    content = (
      <MainVotingPage
        election={election}
        draft={draft}
        dispatch={dispatch}
        onProceedToReview={() => setIsReviewing(true)}
      />
    );
  }

  return <VotePageShell>{content}</VotePageShell>;
}

// Single route for the whole vote flow (build spec §2) — entirely
// client-rendered since the session holds a bearer token that must never
// touch the server render path. Which step COMPONENT renders here is
// governed by useRequireStep, not by a Next.js route change.
export default function VotePage() {
  const { electionId } = useParams<{ electionId: string }>();
  const { state } = useVotingSession();

  if (state.step === 'idle' || state.step === 'otp_pending') {
    return (
      <VoteFlowLayout electionId={electionId}>
        {state.step === 'idle' ? <VerifyIdentityForm /> : <OtpEntryForm />}
      </VoteFlowLayout>
    );
  }

  return <BallotFlow electionId={electionId} />;
}
