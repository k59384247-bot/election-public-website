'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight, Ban, Check, FileCheck2, Lock } from 'lucide-react';
import type { Election } from '@/lib/types';
import { formatElectionDate, formatTime } from '@/features/election/format';
import { useVotingSession } from '../VotingSessionContext';
import { ElectionHead } from './ElectionHead';
import { NoticeCard } from './NoticeCard';
import { AssistanceCard } from './AssistanceCard';

const WHAT_HAPPENS_NEXT_ITEMS = [
  { icon: Lock, text: 'Your vote has been encrypted.' },
  { icon: Ban, text: 'Your ballot cannot be changed.' },
  { icon: FileCheck2, text: 'Results will be published after voting closes.' },
];

/**
 * Screen 8 (Vote Successful Page). Reads receiptCode/alreadyVoted from the
 * reducer — receiptCode is null on the ALREADY_VOTED-treated-as-success
 * path (build spec §9.3), in which case this shows the success message
 * without a code instead of an error or a blank field.
 */
export function VoteSuccessPage({ election }: { election: Election }) {
  const { state, reset } = useVotingSession();

  // Reset on unmount rather than on the Link's click: dispatching RESET
  // synchronously in onClick flips step back to 'idle' while this route is
  // still mounted (Next's client-side nav hasn't swapped the page yet),
  // which briefly re-renders the identity-verification form before the
  // navigation to "/" completes. Resetting on unmount defers it until after
  // the route has actually changed, so nothing flashes.
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <>
      <ElectionHead election={election} />

      <section className="success-card" aria-labelledby="success-title">
        <div className="success-card__head">
          <span className="success-card__badge">
            <Check className="success-card__badge-icon" style={{ color: 'var(--color-white)' }} aria-hidden="true" />
          </span>

          <div className="success-card__copy">
            <h2 className="success-card__title" id="success-title">
              {state.alreadyVoted ? 'Your Vote Was Already Recorded' : 'Your Vote Has Been Successfully Cast'}
            </h2>
            <div className="success-card__desc">
              {state.alreadyVoted ? (
                <p>
                  Our records show a vote from you was already recorded for this election. Your ballot is
                  safe and is only ever counted once.
                </p>
              ) : (
                <>
                  <p>Thank you for participating in the {election.title}.</p>
                  <p>
                    Your ballot has been securely recorded and will remain anonymous throughout the electoral
                    process.
                  </p>
                  <p>Your participation contributes to a fair, transparent and democratic election.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {(state.receiptCode || state.submittedAt) && (
          <div className="success-card__meta">
            {state.receiptCode && (
              <div className="success-card__row">
                <span className="success-card__label">Reference ID:</span>
                <span className="success-card__value">{state.receiptCode}</span>
              </div>
            )}
            {state.submittedAt && (
              <div className="success-card__row">
                <span className="success-card__label">Submitted:</span>
                <span className="success-card__value-group">
                  <span className="success-card__value">{formatElectionDate(state.submittedAt)}</span>
                  <span className="success-card__dot" aria-hidden="true" />
                  <span className="success-card__value">{formatTime(state.submittedAt)}</span>
                </span>
              </div>
            )}
          </div>
        )}

        {!state.alreadyVoted && (
          <p className="success-card__note">Voting closes today by {formatTime(election.endDate)}.</p>
        )}
      </section>

      <Link className="pagination__btn success-cta" href="/">
        Return to Election Information
        <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
      </Link>

      <div className="verify__row">
        <NoticeCard title="What Happens Next?" items={WHAT_HAPPENS_NEXT_ITEMS} />
        <AssistanceCard election={election} />
      </div>
    </>
  );
}

/**
 * No dedicated Figma screen for this (build spec §7.0) — kept minimal and
 * styled consistently with the app's general warning treatment rather than
 * replicating the full receipt screen. Wording is deliberately distinct
 * from a generic error and branches on why castVote() failed: a genuine
 * election-state rejection reads as "voting closed/paused"; an exhausted
 * network retry reads as a submission failure the voter can retry.
 */
export function RejectedElectionState() {
  const { state, reset } = useVotingSession();
  const isNetworkFailure = state.rejectionReason === 'network';

  // See the matching comment in VoteSuccessPage — reset on unmount, not on
  // the Link's click, so the identity form doesn't flash before navigation
  // to "/" completes.
  useEffect(() => {
    return () => reset();
  }, [reset]);

  return (
    <section className="card rejected-card" aria-labelledby="rejected-title" role="alert">
      <h2 className="card__title" id="rejected-title">
        {isNetworkFailure ? 'We Could Not Submit Your Vote' : 'Voting Is No Longer Available'}
      </h2>
      <p className="rejected-card__subtitle">
        {isNetworkFailure
          ? "We couldn't reach the server to confirm your submission, even after retrying. Please start again from the Home Page."
          : 'Voting for this election was closed or paused after you started. Your selections were not submitted.'}
      </p>
      <Link className="btn btn--gold" href="/">
        Back to Home Page
      </Link>
    </section>
  );
}
