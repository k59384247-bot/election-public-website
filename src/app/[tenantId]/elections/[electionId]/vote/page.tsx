'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import '@/app/elections/[electionId]/vote/vote.css';
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

function BallotFlow({ electionId }: { electionId: string }) {
  useRequireStep(BALLOT_STEPS);
  const { state, dispatch: sessionDispatch } = useVotingSession();
  const { election, isLoading, isError, retry } = useFullElection(electionId);
  const { draft, dispatch } = useBallotDraft(electionId);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (state.step === 'token_acquired') {
      sessionDispatch({ type: 'PROCEED_TO_BALLOT' });
    }
  }, [state.step, sessionDispatch]);

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

  const hasCenteredLogo =
    Boolean(election) &&
    !isLoading &&
    state.step !== 'submitting' &&
    state.step !== 'rejected_election_state';

  return <VotePageShell mobileCenteredLogo={hasCenteredLogo}>{content}</VotePageShell>;
}

export default function VotePage() {
  const { electionId } = useParams<{ tenantId: string; electionId: string }>();
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
