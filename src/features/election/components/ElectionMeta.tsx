'use client';

import { Calendar, Clock } from 'lucide-react';
import {
  formatElectionDate,
  formatElectionDateTimeRange,
  formatElectionTimeRange,
  isMultiDayElection,
} from '../format';

/**
 * Calendar/clock meta row shared by the ballot-flow hero (ElectionHead) and
 * the identity-verify/OTP hero (VoteFlowLayout) — a single merged row for
 * elections spanning more than one calendar day in Africa/Lagos, the
 * existing two-row date/time split otherwise.
 */
export function ElectionMeta({ startDate, endDate }: { startDate: string; endDate: string }) {
  if (isMultiDayElection(startDate, endDate)) {
    return (
      <div className="hero__meta">
        <span className="hero__meta-item hero__meta-item--wrap">
          <Calendar className="hero__meta-icon" style={{ color: 'var(--color-header-text)' }} aria-hidden="true" />
          {formatElectionDateTimeRange(startDate, endDate)}
        </span>
      </div>
    );
  }

  return (
    <div className="hero__meta">
      <span className="hero__meta-item">
        <Calendar className="hero__meta-icon" style={{ color: 'var(--color-header-text)' }} aria-hidden="true" />
        {formatElectionDate(startDate)}
      </span>
      <span className="hero__meta-item">
        <Clock className="hero__meta-icon" style={{ color: 'var(--color-header-text)' }} aria-hidden="true" />
        {formatElectionTimeRange(startDate, endDate)}
      </span>
    </div>
  );
}
