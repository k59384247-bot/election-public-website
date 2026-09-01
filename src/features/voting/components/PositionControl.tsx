'use client';

import { useState, type Dispatch, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Download, Video } from 'lucide-react';
import type { Position } from '@/lib/types';
import type { BallotDraftAction } from '../useBallotDraft';
import { PositionHeader } from './PositionHeader';
import { CandidateAvatar } from './CandidateAvatar';

/**
 * Renders one position's candidate list for the ballot screen. The control
 * itself — not just the reducer — must make it impossible to construct an
 * invalid state: a single-choice (maxVotesPerVoter === 1) position behaves
 * as a radio group, a multi-choice position behaves as a checkbox group
 * and disables every unchecked candidate once the cap is reached.
 */
export function PositionControl({
  position,
  positionNumber,
  inverted,
  selectedCandidateIds,
  isWithheld,
  dispatch,
}: {
  position: Position;
  positionNumber: number;
  inverted: boolean;
  selectedCandidateIds: string[];
  isWithheld: boolean;
  dispatch: Dispatch<BallotDraftAction>;
}) {
  const [openCandidateIds, setOpenCandidateIds] = useState<Set<string>>(new Set());
  const isSingleChoice = position.maxVotesPerVoter === 1;
  const atCap = !isSingleChoice && selectedCandidateIds.length >= position.maxVotesPerVoter;
  const titleId = `pos-${position.id}`;

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

  function handleSelect(candidateId: string, disabled: boolean) {
    if (disabled) return;
    const isSelected = selectedCandidateIds.includes(candidateId);

    if (isSingleChoice) {
      if (isSelected) return;
      dispatch({
        type: 'SELECT_CANDIDATE',
        positionId: position.id,
        candidateId,
        maxVotesPerVoter: position.maxVotesPerVoter,
      });
      return;
    }

    if (isSelected) {
      dispatch({ type: 'DESELECT_CANDIDATE', positionId: position.id, candidateId });
      return;
    }

    if (atCap) return;
    dispatch({
      type: 'SELECT_CANDIDATE',
      positionId: position.id,
      candidateId,
      maxVotesPerVoter: position.maxVotesPerVoter,
    });
  }

  function handleWithhold() {
    dispatch({ type: 'SELECT_WITHHELD', positionId: position.id });
  }

  function handleCandidateKeyDown(event: KeyboardEvent<HTMLDivElement>, candidateId: string, disabled: boolean) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(candidateId, disabled);
    }
  }

  return (
    <section className="position-group" aria-labelledby={titleId}>
      <PositionHeader
        positionNumber={positionNumber}
        inverted={inverted}
        title={position.title}
        maxVotesPerVoter={position.maxVotesPerVoter}
        titleId={titleId}
      />

      <div
        className="candidate-list"
        role={isSingleChoice ? 'radiogroup' : 'group'}
        aria-labelledby={titleId}
      >
        {position.candidates.map((candidate) => {
          const isSelected = selectedCandidateIds.includes(candidate.id);
          const isOpen = openCandidateIds.has(candidate.id);
          const isDisabled = !isSelected && !isSingleChoice && atCap;

          return (
            <div
              key={candidate.id}
              className={
                'candidate' +
                (isSelected ? ' candidate--selected' : '') +
                (isOpen ? ' is-open' : '')
              }
              role={isSingleChoice ? 'radio' : 'checkbox'}
              aria-checked={isSelected}
              aria-disabled={isDisabled || undefined}
              tabIndex={isDisabled ? -1 : 0}
              onClick={() => handleSelect(candidate.id, isDisabled)}
              onKeyDown={(event) => handleCandidateKeyDown(event, candidate.id, isDisabled)}
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
                    aria-controls={`panel-${candidate.id}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDetails(candidate.id);
                    }}
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
                  <span
                    className={'select-radio' + (isSelected ? ' select-radio--on' : '')}
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className={'select-check' + (isSelected ? ' select-check--on' : '')}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <Check className="select-check__icon" style={{ color: 'var(--color-white)' }} />
                    )}
                  </span>
                )}
              </div>

              <div className="candidate__panel" id={`panel-${candidate.id}`}>
                <p className="candidate__panel-text">{candidate.manifesto}</p>
                <div className="candidate__panel-actions">
                  {candidate.manifestoDocumentUrl && (
                    <a
                      className="candidate__chip"
                      href={candidate.manifestoDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
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
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Video className="candidate__chip-icon" style={{ color: 'var(--color-neutral-800)' }} aria-hidden="true" />
                      Campaign Video
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Not counted against maxVotesPerVoter — an explicit way to record
            "no selection" rather than simply never interacting with this
            position. Always a single mutually-exclusive control even on
            checkbox (multi-select) positions, matching screens-html. */}
        <div
          className={'candidate candidate--withhold' + (isWithheld ? ' candidate--selected' : '')}
          role="radio"
          aria-checked={isWithheld}
          tabIndex={0}
          onClick={handleWithhold}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleWithhold();
            }
          }}
        >
          <div className="candidate__row">
            <span className="candidate__withhold-label">Withhold Vote</span>
            <span className={'select-radio' + (isWithheld ? ' select-radio--on' : '')} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
