'use client';

import { Mail, UserCheck } from 'lucide-react';
import type { Election, PublicElectionStatus } from '@/lib/types';
import { useVotingSession } from '../VotingSessionContext';
import { ElectionMeta } from '@/features/election/components/ElectionMeta';
import { TenantLogo } from '@/features/tenant/components/TenantLogo';
import { useTenant } from '@/features/tenant/TenantContext';
import { ElectionBackLink } from './ElectionBackLink';

const STATUS_LABEL: Record<PublicElectionStatus, string> = {
  voting_open: 'VOTING IN PROGRESS',
  voting_paused: 'VOTING PAUSED',
  voting_closed: 'VOTING CLOSED',
  results_published: 'RESULTS PUBLISHED',
  upcoming: 'UPCOMING',
};

/** Election summary + voter identity tags shown at the top of every ballot/review/receipt screen. */
export function ElectionHead({ election, showVoterDetails = true, showMobileBackLink = false }: { election: Election; showVoterDetails?: boolean; showMobileBackLink?: boolean }) {
  const { state, emailLinkExpiresAt } = useVotingSession();
  const { tenantId } = useTenant();

  return (
    <section className="election-head" aria-labelledby="election-title">
      <TenantLogo className="election-head__logo" />

      {showMobileBackLink && <ElectionBackLink tenantId={tenantId} className="verify__mobile-back" />}

      <span className="status-pill">
        <span className="status-pill__dot" aria-hidden="true" />
        {STATUS_LABEL[election.status]}
      </span>

      <h1 className="election-head__title" id="election-title">
        {election.title}
      </h1>

      <ElectionMeta startDate={election.startDate} endDate={election.endDate} />
      {showVoterDetails && typeof emailLinkExpiresAt === 'number' && state.step !== 'voted' && (
        <p className="verify-form__note">
          Submit before <time dateTime={new Date(emailLinkExpiresAt).toISOString()}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(emailLinkExpiresAt)}</time> or voting closes, whichever comes first. Refreshing does not extend your session.
        </p>
      )}

      {showVoterDetails && (state.matricNumber || state.email) && (
        <div className="voter-tags">
          <span className="voter-tags__label">Voter&apos;s Details:</span>
          <div className="voter-tags__list">
            {state.matricNumber && (
              <span className="voter-tag">
                <UserCheck className="voter-tag__icon" style={{ color: 'var(--color-wine)' }} aria-hidden="true" />
                <span className="voter-tag__text">{state.matricNumber}</span>
              </span>
            )}
            {state.email && (
              <span className="voter-tag">
                <Mail className="voter-tag__icon" style={{ color: 'var(--color-header-text)' }} aria-hidden="true" />
                <span className="voter-tag__text">{state.email}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
