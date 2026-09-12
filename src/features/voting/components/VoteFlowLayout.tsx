'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck, UserCog, VenetianMask, Waves } from 'lucide-react';
import type { PublicElectionStatus } from '@/lib/types';
import { useElection } from '@/features/election/useElection';
import { getElectionById } from '@/features/election/api';
import { ElectionMeta } from '@/features/election/components/ElectionMeta';
import { AssistanceCard } from './AssistanceCard';
import { useTenant } from '@/features/tenant/TenantContext';
import { TenantLogo } from '@/features/tenant/components/TenantLogo';
import { getTenantTerminology } from '@/features/tenant/terminology';
import { ElectionAccessGate } from './ElectionAccessGate';

const STATUS_CONFIG: Record<PublicElectionStatus, { label: string; pillClass: string }> = {
  voting_open: { label: 'VOTING IN PROGRESS', pillClass: 'status-pill--open' },
  voting_paused: { label: 'VOTING PAUSED', pillClass: 'status-pill--paused' },
  voting_closed: { label: 'VOTING CLOSED', pillClass: 'status-pill--closed' },
  results_published: { label: 'RESULTS PUBLISHED', pillClass: 'status-pill--closed' },
  upcoming: { label: 'UPCOMING', pillClass: 'status-pill--upcoming' },
};

/**
 * Shared chrome for the verify-identity/verify-email screens: nav, back
 * link, election hero, Voting Notice and Assistance panels — identical
 * markup across both screens-html pages, only the center card differs.
 * The election hero fetch is best-effort and non-blocking: a slow/failed
 * fetch must never prevent the identity/OTP form (passed as `children`)
 * from working, since that's this route's actual job.
 */
export function VoteFlowLayout({
  electionId,
  children,
}: {
  electionId: string;
  children: ReactNode;
}) {
  const { tenantId, tenant } = useTenant();
  const terminology = getTenantTerminology(tenant.organizationType);
  const { election } = useElection(electionId);

  // Separate from the hero fetch above and deliberately NOT the
  // useFullElection *hook* (that one is reserved for the ballot/review/
  // receipt screens post 'token_acquired' and never refetches by design).
  // This is a plain, best-effort, refetchable query like the hero — while
  // it's loading or fails, AssistanceCard just shows no contact methods yet
  // rather than blocking the identity form.
  //
  // Deliberately uses the SAME query key as useFullElection
  // (['election-full', electionId]) so this fetch warms that cache entry:
  // getElectionById is ~1s against the current staging backend, and if the
  // voter reaches the ballot screen after already sitting on this one for a
  // few seconds, useFullElection finds the data already there instead of
  // paying that cost again. Safe to share: useFullElection's own
  // staleTime: Infinity means once IT mounts, it treats whatever's cached
  // (even if fetched here) as fresh forever and never refetches — this
  // query's own default staleTime only governs refetching while this
  // component is still mounted, pre-auth.
  const { data: fullElection } = useQuery({
    queryKey: ['election-full', tenantId, electionId],
    queryFn: () => getElectionById(tenantId, electionId),
  });
  // Prefer the election-list status because that query is explicitly
  // refreshed for status correctness. The detail payload may have been
  // prefetched while the election was still open and can remain in React
  // Query's one-minute cache after the dashboard changes the status.
  const displayedElection = fullElection ?? election;
  const electionStatus = election?.status ?? fullElection?.status;
  const status = electionStatus ? STATUS_CONFIG[electionStatus] : undefined;

  return (
    <div className="verify verify--mobile-centered-logo">
      <header>
        <nav className="navbar" aria-label="Primary">
          <Link className="navbar__brand" href={`/${tenantId}`} aria-label={`${tenant.name} home`}>
            <TenantLogo className="navbar__logo" />
          </Link>
        </nav>
      </header>

      <main className="verify__main">
        <Link className="btn btn--ghost verify__desktop-back" href={`/${tenantId}`}>
          <ArrowRight
            className="btn__icon"
            aria-hidden="true"
            style={{ transform: 'rotate(180deg)' }}
          />
          Back to Elections
        </Link>

        <div className="verify__row">
          <section className="verify__col hero" aria-labelledby="election-title">
            <TenantLogo className="hero__logo" />

            <Link className="btn btn--ghost verify__mobile-back" href={`/${tenantId}`}>
              <ArrowRight
                className="btn__icon"
                aria-hidden="true"
                style={{ transform: 'rotate(180deg)' }}
              />
              Back to Elections
            </Link>

            {status && (
              <span className={`status-pill ${status.pillClass}`}>
                <span className="status-pill__dot" aria-hidden="true" />
                {status.label}
              </span>
            )}

            <div className="hero__heading">
              <h1 className="hero__title" id="election-title">
                {displayedElection?.title ?? 'Election'}
              </h1>
              {displayedElection && (
                <p className="hero__description">{displayedElection.description}</p>
              )}
            </div>

            {displayedElection && (
              <ElectionMeta
                startDate={displayedElection.startDate}
                endDate={displayedElection.endDate}
              />
            )}
          </section>

          <ElectionAccessGate status={electionStatus}>{children}</ElectionAccessGate>
        </div>

        <div className="verify__row">
          <section className="verify__col card notice" aria-labelledby="notice-title">
            <div className="notice__head">
              <h2 className="card__title" id="notice-title">
                Voting Notice
              </h2>
              <p className="notice__lead">Before you begin, please note:</p>
            </div>

            <ul className="notice__list" role="list">
              <li className="notice__item">
                <span className="icon-badge">
                  <ShieldCheck
                    className="icon-badge__icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                </span>
                <p className="notice__text">
                  You will verify your identity using your {terminology.identifierLabel.toLowerCase()} and email address.
                </p>
              </li>
              <li className="notice__item">
                <span className="icon-badge">
                  <UserCog
                    className="icon-badge__icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                </span>
                <p className="notice__text">
                  You can review and edit your selections before submitting.
                </p>
              </li>
              <li className="notice__item">
                <span className="icon-badge">
                  <Waves
                    className="icon-badge__icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                </span>
                <p className="notice__text">Each eligible student can vote only once.</p>
              </li>
              <li className="notice__item">
                <span className="icon-badge">
                  <VenetianMask
                    className="icon-badge__icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                </span>
                <p className="notice__text">
                  Your vote remains anonymous throughout the election process.
                </p>
              </li>
            </ul>
          </section>

          <AssistanceCard election={fullElection} />
        </div>
      </main>
    </div>
  );
}
