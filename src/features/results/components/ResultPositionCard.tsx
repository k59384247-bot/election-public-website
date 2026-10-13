'use client';

import { Check, ChevronDown, Scale } from 'lucide-react';
import { CandidateAvatar } from '@/features/voting/components/CandidateAvatar';
import { PositionHeader } from '@/features/voting/components/PositionHeader';
import type { ResultCandidate, ResultPosition } from '../model';

function OutcomeBadges({ candidate, seats }: { candidate: ResultCandidate; seats: number }) {
  const declaredElected = candidate.winner && !(candidate.isTie && seats === 1);
  return <span className="outcome-badges">
    {declaredElected && <span className="outcome-badge"><Check size={14} aria-hidden="true" />Elected</span>}
    {candidate.isTie && <span className="outcome-badge outcome-badge--tie"><Scale size={14} aria-hidden="true" />Tied</span>}
  </span>;
}

export function ResultPositionCard({ position, index }: { position: ResultPosition; index: number }) {
  const winners = position.candidates.filter((candidate) => candidate.winner);
  const tied = winners.some((candidate) => candidate.isTie);
  return <section className="winner-position" aria-labelledby={`result-position-${position.id}`}>
    <PositionHeader positionNumber={index + 1} inverted={index % 2 === 1} title={position.title}
      maxVotesPerVoter={position.seats} titleId={`result-position-${position.id}`} variant="results" />
    <div className={`candidate winner-card${tied ? ' winner-card--tie' : ''}`}>
      <div className="winner-card__people">
        {winners.length ? winners.map((candidate) => <div className="winner-person" key={candidate.candidateId}>
          <CandidateAvatar name={candidate.candidateName} photoUrl={candidate.photoUrl} />
          <div><OutcomeBadges candidate={candidate} seats={position.seats} /><h4>{candidate.candidateName}</h4>
            <p>{candidate.votes.toLocaleString('en-US')} votes <span>· {candidate.percent.toFixed(2)}%</span></p></div>
        </div>) : <div className="winner-empty"><h4>No candidate elected</h4><p>{position.candidates.length === 0 ? 'No candidates were configured for this position.' : position.candidates.every((candidate) => candidate.votes === 0) ? 'No positive votes were recorded for this position.' : 'No elected candidate has been declared for this position.'}</p></div>}
      </div>
      {tied && <p className="winner-tie-copy">{position.seats === 1 ? 'The leading candidates are tied for one seat.' : 'All candidates tied at the winning cutoff are elected under the current result rules.'}</p>}
      {position.candidates.length > 0 && <details className="winner-breakdown"><summary>
        <span className="winner-breakdown__label--closed">View full count</span>
        <span className="winner-breakdown__label--open">Hide full count</span>
        <span className="visually-hidden"> for {position.title}</span>
        <span className="winner-breakdown__toggle" aria-hidden="true"><ChevronDown size={20} /></span>
      </summary>
        <ul className="result-rows" role="list" aria-label={`${position.title} candidate results`}>
          {position.candidates.map((candidate) => {
            const declaredElected = candidate.winner && !(candidate.isTie && position.seats === 1);
            return <li className={`result-row${declaredElected ? ' result-row--elected' : ''}`} key={candidate.candidateId}>
            <CandidateAvatar name={candidate.candidateName} photoUrl={candidate.photoUrl} />
            <div className="result-person"><div className="result-person__top"><span className="candidate__name">{candidate.candidateName}</span><OutcomeBadges candidate={candidate} seats={position.seats} /></div>
              <div className="result-bar" aria-hidden="true"><span className={declaredElected ? 'result-bar__fill result-bar__fill--elected' : 'result-bar__fill'} style={{ width: `${Math.max(0, Math.min(100, candidate.percent))}%` }} /></div></div>
            <div className="result-count"><strong>{candidate.votes.toLocaleString('en-US')} <span>votes</span></strong><span>{candidate.percent.toFixed(2)}% of selections</span></div>
          </li>;
          })}
        </ul>
        {position.seats > 1 && <p className="result-note">Voters could select up to {position.seats} candidates.</p>}
      </details>}
    </div>
  </section>;
}
