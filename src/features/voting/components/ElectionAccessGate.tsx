'use client';

import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { PublicElectionStatus } from '@/lib/types';

interface LockedStatusContent {
  eyebrow: string;
  title: string;
  message: string;
}

const LOCKED_STATUS_CONTENT: Partial<Record<PublicElectionStatus, LockedStatusContent>> = {
  upcoming: {
    eyebrow: 'Upcoming election',
    title: 'Voting opens soon',
    message: 'This election is not accepting votes yet. Please return when voting begins.',
  },
  voting_paused: {
    eyebrow: 'Voting paused',
    title: 'Voting is temporarily paused',
    message: 'The Electoral Committee has paused voting. Please check back for updates.',
  },
  voting_closed: {
    eyebrow: 'Voting closed',
    title: 'This election has ended',
    message: 'Identity verification and voting are no longer available for this election.',
  },
  results_published: {
    eyebrow: 'Results published',
    title: 'Voting has ended',
    message: 'This election is closed to new votes and its results have been published.',
  },
};

/**
 * Keeps the familiar verification card visible while making every non-open
 * election unmistakably unavailable and removing the form from keyboard and
 * assistive-technology interaction.
 */
export function ElectionAccessGate({
  status,
  children,
}: {
  status?: PublicElectionStatus;
  children: ReactNode;
}) {
  const lockedContent = status ? LOCKED_STATUS_CONTENT[status] : undefined;
  const isLocked = lockedContent !== undefined;

  return (
    <div className={`election-access-gate${isLocked ? ' election-access-gate--locked' : ''}`}>
      <div
        className="election-access-gate__content"
        inert={isLocked ? true : undefined}
        aria-hidden={isLocked ? true : undefined}
      >
        {children}
      </div>

      {lockedContent && (
        <section
          className="election-access-gate__overlay"
          aria-labelledby="election-access-title"
          aria-describedby="election-access-message"
          aria-live="polite"
        >
          <div className="election-access-gate__lock" aria-hidden="true">
            <LockKeyhole />
          </div>
          <p className="election-access-gate__eyebrow">{lockedContent.eyebrow}</p>
          <h2 className="election-access-gate__title" id="election-access-title">
            {lockedContent.title}
          </h2>
          <p className="election-access-gate__message" id="election-access-message">
            {lockedContent.message}
          </p>
        </section>
      )}
    </div>
  );
}
