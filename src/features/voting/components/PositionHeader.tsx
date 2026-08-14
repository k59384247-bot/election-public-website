import { User } from 'lucide-react';

/**
 * Numbered position banner (badge + icon + name + vote-limit pill), reused
 * identically by the ballot (PositionControl) and review (VoteReviewPage)
 * screens — byte-identical markup, only the surrounding candidate list
 * differs between an interactive control and a read-only summary.
 */
export function PositionHeader({
  positionNumber,
  inverted,
  title,
  maxVotesPerVoter,
  titleId,
}: {
  positionNumber: number;
  inverted: boolean;
  title: string;
  maxVotesPerVoter: number;
  titleId: string;
}) {
  return (
    <div className={inverted ? 'position position--inverted' : 'position'}>
      <span className="position__number">{positionNumber}</span>
      <div className="position__bar">
        <div className="position__title">
          <span className="position__icon-badge">
            <User
              className="position__icon"
              style={{ color: inverted ? 'var(--color-wine)' : 'var(--color-header-text)' }}
              aria-hidden="true"
            />
          </span>
          <span className="position__name" id={titleId}>
            {title}
          </span>
        </div>
        <div className="position__limit">
          <span className="position__limit-label">
            <span className="position__limit-label-full">Max. Vote Allowed:</span>
            <span className="position__limit-label-short">Max.</span>
          </span>
          <span className="position__limit-value">{maxVotesPerVoter}</span>
        </div>
      </div>
    </div>
  );
}
