'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, Download, Pencil, UserCog, VenetianMask, Video, Waves } from 'lucide-react';
import type { Election } from '@/lib/types';
import type { BallotDraft } from '../useBallotDraft';
import { ElectionHead } from './ElectionHead';
import { PositionHeader } from './PositionHeader';
import { NoticeCard } from './NoticeCard';
import { AssistanceCard } from './AssistanceCard';
import { CandidateAvatar } from './CandidateAvatar';
import { resetPaginationScroll } from '@/lib/paginationScroll';

const VOTING_NOTICE_ITEMS = [
  { icon: UserCog, text: 'You can review and edit your selections before submitting.' },
  { icon: Waves, text: 'Each eligible student can vote only once.' },
  { icon: VenetianMask, text: 'Your vote remains anonymous throughout the election process.' },
];

/**
 * Screen 6 (Vote Review Page) — read-only summary of the current ballot
 * draft. Explicit withheld positions are shown as "Withhold Vote". Positions
 * with zero selections are shown as "No selection" as a defensive fallback.
 * "Submit My Vote"
 * only opens ConfirmSubmissionModal (via onSubmit) — it must never call the
 * API itself.
 */
export function VoteReviewPage({
  election,
  draft,
  onEdit,
  onSubmit,
}: {
  election: Election;
  draft: BallotDraft;
  onEdit: () => void;
  onSubmit: () => void;
}) {
  const positions = useMemo(
    () => [...election.positions].sort((a, b) => a.order - b.order),
    [election.positions]
  );
  const [openCandidateIds, setOpenCandidateIds] = useState<Set<string>>(new Set());

  // Mounts fresh whenever the voter hits "Proceed to Review" — this is a
  // client-rendered step swap, not a route change, so the browser keeps
  // whatever scroll offset the ballot page left it at instead of resetting.
  // Reset explicitly so the voter lands at the top of the review, not
  // wherever the (differently-sized) ballot page happened to be scrolled to.
  useEffect(() => {
    resetPaginationScroll();
  }, []);

  function toggleDetails(candidateId: string) {
    setOpenCandidateIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) {
        next.delete(candidateId);
      } else {
        next.add(candidateId);
      }
      return next;
    });
  }

  return (
    <>
      <ElectionHead election={election} />

      <button
        className="pagination__btn pagination__btn--prev review-top-back"
        type="button"
        onClick={() => {
          resetPaginationScroll();
          onEdit();
        }}
      >
        <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
        Go Back
      </button>

      <nav className="review-bar" aria-label="Review navigation">
        <h2 className="review-bar__title">REVIEW YOUR VOTES</h2>
      </nav>

      <div className="vote__ballot">
        <div className="vote__positions">
          {positions.map((position, index) => {
            const selectedIds = draft.selections[position.id] ?? [];
            const isWithheld = draft.withheldPositionIds.includes(position.id);
            const selectedCandidates = position.candidates.filter((candidate) =>
              selectedIds.includes(candidate.id)
            );
            const isSingleChoice = position.maxVotesPerVoter === 1;
            const titleId = `rv-pos-${position.id}`;

            return (
              <section key={position.id} className="position-group" aria-labelledby={titleId}>
                <PositionHeader
                  positionNumber={index + 1}
                  inverted={index % 2 === 1}
                  title={position.title}
                  maxVotesPerVoter={position.maxVotesPerVoter}
                  titleId={titleId}
                />

                <div className="review-block">
                  <div className="candidate-list">
                    {selectedCandidates.length === 0 ? (
                      <div className="candidate candidate--withhold">
                        <div className="candidate__row">
                          <span className="candidate__withhold-label">
                            {isWithheld ? 'Withhold Vote' : 'No selection'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      selectedCandidates.map((candidate) => {
                        const isOpen = openCandidateIds.has(candidate.id);
                        const panelId = `rv-panel-${candidate.id}`;
                        return (
                          <div
                            key={candidate.id}
                            className={'candidate candidate--selected' + (isOpen ? ' is-open' : '')}
                          >
                            <div className="candidate__row">
                              <CandidateAvatar
                                name={candidate.name}
                                photoUrl={candidate.photoUrl}
                              />
                              <div className="candidate__info">
                                <div className="candidate__identity">
                                  <span className="candidate__name">{candidate.name}</span>
                                  {candidate.nickname && (
                                    <span className="candidate__nickname">({candidate.nickname})</span>
                                  )}
                                </div>
                                <button
                                  className="candidate__details"
                                  type="button"
                                  aria-expanded={isOpen}
                                  aria-controls={panelId}
                                  onClick={() => toggleDetails(candidate.id)}
                                >
                                  View Details
                                  <ChevronDown
                                    className="candidate__details-icon"
                                    style={{ color: 'var(--color-amber)' }}
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                              {isSingleChoice ? (
                                <span className="select-radio select-radio--on" aria-hidden="true" />
                              ) : (
                                <span className="select-check select-check--on" aria-hidden="true">
                                  <Check className="select-check__icon" style={{ color: 'var(--color-white)' }} />
                                </span>
                              )}
                            </div>
                            <div className="candidate__panel" id={panelId}>
                              <p className="candidate__panel-text">{candidate.manifesto}</p>
                              <div className="candidate__panel-actions">
                                {candidate.manifestoDocumentUrl && (
                                  <a
                                    className="candidate__chip"
                                    href={candidate.manifestoDocumentUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Download
                                      className="candidate__chip-icon"
                                      style={{ color: 'var(--color-neutral-800)' }}
                                      aria-hidden="true"
                                    />
                                    Manifesto
                                  </a>
                                )}
                                {candidate.campaignVideoUrl && (
                                  <a
                                    className="candidate__chip"
                                    href={candidate.campaignVideoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Video
                                      className="candidate__chip-icon"
                                      style={{ color: 'var(--color-neutral-800)' }}
                                      aria-hidden="true"
                                    />
                                    Campaign Video
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <button className="edit-vote" type="button" onClick={onEdit}>
                    <Pencil className="edit-vote__icon" style={{ color: 'var(--color-amber)' }} aria-hidden="true" />
                    Edit Vote
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        <div className="review-pagination">
          <p className="review-pagination__note">
            You&apos;ve completed all {positions.length} position{positions.length === 1 ? '' : 's'}. Once
            your ballot has been submitted, it cannot be changed.
          </p>
          <div className="review-pagination__row">
            <button className="pagination__btn pagination__btn--prev" type="button" onClick={onEdit}>
              <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
              Go Back
            </button>
            <button className="pagination__btn review-submit" type="button" onClick={onSubmit}>
              Submit My Vote
              <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="verify__row">
        <NoticeCard title="VOTING NOTICE" lead="Before you begin, please note:" items={VOTING_NOTICE_ITEMS} />
        <AssistanceCard election={election} />
      </div>
    </>
  );
}
