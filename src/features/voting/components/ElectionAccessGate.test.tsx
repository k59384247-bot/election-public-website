// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PublicElectionStatus } from '@/lib/types';
import { ElectionAccessGate } from './ElectionAccessGate';

const LOCKED_STATUS_CASES: Array<[PublicElectionStatus, string, string]> = [
  ['upcoming', 'Upcoming election', 'Voting opens soon'],
  ['voting_paused', 'Voting paused', 'Voting is temporarily paused'],
  ['voting_closed', 'Voting closed', 'This election has ended'],
  ['results_published', 'Results published', 'Voting has ended'],
];

describe('ElectionAccessGate', () => {
  afterEach(cleanup);

  it.each(LOCKED_STATUS_CASES)(
    'locks the verification card for %s elections',
    (status, eyebrow, title) => {
      const { container } = render(
        <ElectionAccessGate status={status}>
          <button type="button">Continue</button>
        </ElectionAccessGate>
      );

      expect(screen.getByText(eyebrow)).toBeTruthy();
      expect(screen.getByRole('heading', { name: title })).toBeTruthy();
      expect(container.querySelector('.election-access-gate__content')?.hasAttribute('inert')).toBe(
        true
      );
      expect(
        container.querySelector('.election-access-gate__content')?.getAttribute('aria-hidden')
      ).toBe('true');
    }
  );

  it('leaves an open election interactive and uncovered', () => {
    const { container } = render(
      <ElectionAccessGate status="voting_open">
        <button type="button">Continue</button>
      </ElectionAccessGate>
    );

    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    expect(container.querySelector('.election-access-gate__overlay')).toBeNull();
    expect(container.querySelector('.election-access-gate__content')?.hasAttribute('inert')).toBe(
      false
    );
  });

  it('preserves the card height when the vote layout stacks at tablet widths', () => {
    const voteCss = readFileSync(
      resolve(process.cwd(), 'src/app/elections/[electionId]/vote/vote.css'),
      'utf8'
    );
    const tabletStyles = voteCss.slice(
      voteCss.indexOf('@media (max-width: 1024px)'),
      voteCss.indexOf('@media (max-width: 640px)')
    );

    expect(tabletStyles).toMatch(
      /\.election-access-gate\s*\{[^}]*flex:\s*0 0 auto;/
    );
  });
});
