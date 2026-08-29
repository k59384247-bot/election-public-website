'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { AlertCircle, ArrowRight, UserCog, VenetianMask, Waves } from 'lucide-react';
import type { Election } from '@/lib/types';
import { getIncompletePositionIds, type BallotDraft, type BallotDraftAction } from '../useBallotDraft';
import { PerPageSelect } from '@/components/PerPageSelect';
import { ElectionHead } from './ElectionHead';
import { PositionControl } from './PositionControl';
import { NoticeCard } from './NoticeCard';
import { AssistanceCard } from './AssistanceCard';
import { resetPaginationScroll } from '@/lib/paginationScroll';

const PER_PAGE_OPTIONS = [3, 5, 10] as const;
const DEFAULT_POSITIONS_PER_PAGE = 5;

const VOTING_NOTICE_ITEMS = [
  { icon: UserCog, text: 'You can review and edit your selections before submitting.' },
  { icon: Waves, text: 'Each eligible student can vote only once.' },
  { icon: VenetianMask, text: 'Your vote remains anonymous throughout the election process.' },
];

/**
 * Screens 4/5 (Main Voting Page) — ONE component rendered at every data
 * volume. Pagination is real (page numbers + prev/next), not "load more":
 * screens-html's main-voting.html (page 1 of 3) and main-voting-final.html
 * (last page) are the same markup/component at different pagination
 * states, distinguished only by the primary action button's label, which
 * this component derives from `isLastPage` — never from candidate/position
 * count directly.
 */
export function MainVotingPage({
  election,
  draft,
  dispatch,
  onProceedToReview,
}: {
  election: Election;
  draft: BallotDraft;
  dispatch: Dispatch<BallotDraftAction>;
  onProceedToReview: () => void;
}) {
  const positions = useMemo(
    () => [...election.positions].sort((a, b) => a.order - b.order),
    [election.positions]
  );

  const [page, setPage] = useState(1);
  const [positionsPerPage, setPositionsPerPage] = useState(DEFAULT_POSITIONS_PER_PAGE);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const validationRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const totalPages = Math.max(1, Math.ceil(positions.length / positionsPerPage));
  const currentPage = Math.min(page, totalPages);
  const isLastPage = currentPage === totalPages;
  const startIndex = (currentPage - 1) * positionsPerPage;
  const pagePositions = positions.slice(startIndex, startIndex + positionsPerPage);
  const incompletePositionIds =
    validationAttempt > 0
      ? getIncompletePositionIds(positions.map((position) => position.id), draft)
      : [];

  // This is a client-rendered step swap, not a route change (see page.tsx),
  // so the browser never resets scroll on its own — it keeps whatever
  // offset the previous page/step left it at. Since page/step heights
  // differ, that stale offset can land the voter past the ballot, e.g. on
  // the contact-info card at the bottom. The click handlers reset immediately;
  // this effect catches state changes after the new page has rendered without
  // interfering with browser Back/Forward restoration on initial mount.
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    resetPaginationScroll();
  }, [currentPage, positionsPerPage]);

  useEffect(() => {
    if (validationAttempt > 0) validationRef.current?.focus();
  }, [validationAttempt]);

  function goToPage(next: number) {
    resetPaginationScroll();
    setPage(Math.min(Math.max(1, next), totalPages));
  }

  function handlePerPageChange(nextSize: number) {
    resetPaginationScroll();
    setPositionsPerPage(nextSize);
    setPage(1);
  }

  function handlePrimaryAction() {
    if (isLastPage) {
      const missingPositionIds = getIncompletePositionIds(
        positions.map((position) => position.id),
        draft
      );
      if (missingPositionIds.length > 0) {
        setValidationAttempt((attempt) => attempt + 1);
        return;
      }
      resetPaginationScroll();
      onProceedToReview();
      return;
    }
    goToPage(currentPage + 1);
  }

  return (
    <>
      <ElectionHead election={election} />

      <h2 className="vote__section-title">VOTE YOUR CANDIDATES</h2>

      {incompletePositionIds.length > 0 && (
        <div
          ref={validationRef}
          className="vote-validation"
          role="alert"
          tabIndex={-1}
          aria-labelledby="vote-validation-title"
        >
          <AlertCircle className="vote-validation__icon" aria-hidden="true" />
          <div>
            <h3 id="vote-validation-title" className="vote-validation__title">
              Complete your ballot
            </h3>
            <p className="vote-validation__message">
              Please select a candidate or Withhold Vote for these positions before reviewing your ballot:
            </p>
            <ul className="vote-validation__list">
              {positions
                .filter((position) => incompletePositionIds.includes(position.id))
                .map((position) => (
                  <li key={position.id}>{position.title}</li>
                ))}
            </ul>
          </div>
        </div>
      )}

      <div className="vote__ballot">
        <div className="vote__positions" data-pagination-scroll-container>
          {pagePositions.map((position, indexOnPage) => {
            const globalIndex = startIndex + indexOnPage;
            return (
              <PositionControl
                key={position.id}
                position={position}
                positionNumber={globalIndex + 1}
                inverted={globalIndex % 2 === 1}
                selectedCandidateIds={draft.selections[position.id] ?? []}
                isWithheld={draft.withheldPositionIds.includes(position.id)}
                dispatch={dispatch}
              />
            );
          })}
        </div>

        <nav className="pagination" aria-label="Ballot pages">
          <button
            className="pagination__btn pagination__btn--prev"
            type="button"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
            Previous
          </button>

          <div className="pagination__center">
            <PerPageSelect
              id="positions-per-page"
              label="Results per page"
              value={positionsPerPage}
              options={PER_PAGE_OPTIONS}
              onChange={handlePerPageChange}
            />
            <div className="pagination__numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={
                    pageNumber === currentPage
                      ? 'pagination__page pagination__page--current'
                      : 'pagination__page'
                  }
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                  onClick={() => goToPage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          </div>

          {/* Driven purely by pagination state (isLastPage), never by
              candidate/position count directly. */}
          <button className="pagination__btn pagination__btn--next" type="button" onClick={handlePrimaryAction}>
            {isLastPage ? 'Proceed to Review' : 'Next'}
            <ArrowRight className="pagination__btn-icon" style={{ color: 'var(--color-neutral-900)' }} aria-hidden="true" />
          </button>
        </nav>
      </div>

      <div className="verify__row">
        <NoticeCard title="VOTING NOTICE" lead="Before you begin, please note:" items={VOTING_NOTICE_ITEMS} />
        <AssistanceCard election={election} />
      </div>
    </>
  );
}
