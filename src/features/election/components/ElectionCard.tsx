import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock } from 'lucide-react';
import type { ElectionSummary, PublicElectionStatus } from '@/lib/types';
import {
  formatElectionDate,
  formatElectionDateTimeRange,
  formatElectionTimeRange,
  isMultiDayElection,
} from '../format';
import { getElectionById } from '../api';

export const STATUS_CONFIG: Record<PublicElectionStatus, { label: string; pillClass: string }> = {
  voting_open: { label: 'Voting In Progress', pillClass: 'event-card__status--live' },
  upcoming: { label: 'Upcoming', pillClass: 'event-card__status--upcoming' },
  voting_paused: { label: 'Voting Paused', pillClass: 'event-card__status--paused' },
  voting_closed: { label: 'Voting Closed', pillClass: 'event-card__status--closed' },
  // Results page doesn't exist yet (build spec §7.1 open question) — same
  // "no CTA" treatment as voting_closed, distinct label since we already
  // have the accurate status from the API.
  results_published: { label: 'Results Published', pillClass: 'event-card__status--closed' },
};

export function ElectionCard({ election }: { election: ElectionSummary }) {
  const status = STATUS_CONFIG[election.status];
  const queryClient = useQueryClient();

  // getElectionById is ~1s against the current staging backend, and the
  // vote route is entirely client-rendered (VoteFlowLayout fetches this
  // same data itself), so the voter would otherwise wait for it after
  // navigating. Starting it on hover/focus — before the click even lands —
  // means it's often already resolved (or at least in flight) by the time
  // the vote page mounts. Shares useFullElection's query key so this also
  // warms the ballot screen's cache for later in the flow.
  function prefetchFullElection() {
    queryClient.prefetchQuery({
      queryKey: ['election-full', election.id],
      queryFn: () => getElectionById(election.id),
    });
  }

  // election.status can legitimately disagree between the server render and
  // the client's first read (see the note on the status pill below) — for
  // the CTA row, that disagreement isn't just a text mismatch, it's a whole
  // element appearing/disappearing, which suppressHydrationWarning can't
  // cover. Withhold it until after mount so both hydration passes render
  // nothing here, then let the client-confirmed status decide.
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <article className="event-card">
      <div className="event-card__media">
        {election.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- matches
          // screens-html, which uses plain <img> throughout (no next/image).
          <img className="event-card__media-img" src={election.thumbnailUrl} alt="" />
        ) : null}
        <span className="event-card__tag">
          <span className="event-card__tag-dot" aria-hidden="true" />
          Election
        </span>
      </div>

      <div className="event-card__body">
        <div className="event-card__heading">
          <h2 className="event-card__title">{election.title}</h2>
          <p className="event-card__desc">{election.description}</p>
        </div>

        <div className="event-card__footer">
          <div className="event-card__meta">
            {isMultiDayElection(election.startDate, election.endDate) ? (
              <span className="event-card__meta-item event-card__meta-item--wrap">
                <Calendar
                  className="event-card__meta-icon"
                  style={{ color: 'var(--color-header-text)' }}
                  aria-hidden="true"
                />
                {formatElectionDateTimeRange(election.startDate, election.endDate)}
              </span>
            ) : (
              <>
                <span className="event-card__meta-item">
                  <Calendar
                    className="event-card__meta-icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                  {formatElectionDate(election.startDate)}
                </span>
                <span className="event-card__meta-item">
                  <Clock
                    className="event-card__meta-icon"
                    style={{ color: 'var(--color-header-text)' }}
                    aria-hidden="true"
                  />
                  {formatElectionTimeRange(election.startDate, election.endDate)}
                </span>
              </>
            )}
          </div>

          {/* election.status is computed server-side from wall-clock time and
              refetched live on the client; right as an election opens/closes,
              the two reads can legitimately disagree for a moment. That's
              expected, self-correcting drift, not a rendering bug. */}
          <span
            className={`event-card__status ${status.pillClass}`}
            suppressHydrationWarning
          >
            <span className="event-card__status-dot" aria-hidden="true" />
            <span suppressHydrationWarning>{status.label}</span>
          </span>
        </div>
      </div>

      {hasMounted && election.status === 'voting_open' && (
        <div className="event-card__cta-row">
          <Link
            className="event-card__cta"
            href={`/elections/${election.id}/vote`}
            onMouseEnter={prefetchFullElection}
            onFocus={prefetchFullElection}
          >
            Vote Now
          </Link>
        </div>
      )}

      {hasMounted && election.status === 'voting_paused' && (
        <div className="event-card__cta-row">
          <button className="event-card__cta event-card__cta--disabled" type="button" disabled>
            Vote Now
          </button>
          <p className="event-card__cta-note">Voting is temporarily paused for this election.</p>
        </div>
      )}
    </article>
  );
}
