import { describe, expect, it } from 'vitest';
import type { Election, ElectionResults } from '@/lib/types';
import { buildResultsView, resultsHref, publishedDate } from './model';

const election = { positions: [{ id: 'p1', title: 'President', order: 2, maxVotesPerVoter: 1, candidates: [
  { id: 'a', name: 'Same name', photoUrl: 'https://example.test/a.png' }, { id: 'b', name: 'Same name', photoUrl: null },
] }] } as Election;
const results: ElectionResults = { electionId: 'e1', title: 'Election', totalVotesCast: 2, positions: [
  { positionId: 'p1', positionTitle: 'President', maxVotesPerVoter: 1, results: [
    { candidateId: 'b', candidateName: 'Same name', votes: 1, percent: 50, winner: true, isTie: true },
    { candidateId: 'a', candidateName: 'Same name', votes: 1, percent: 50, winner: true, isTie: true },
  ] },
  { positionId: 'empty', positionTitle: 'Empty', maxVotesPerVoter: 2, order: 0, results: [] },
] };

describe('public results model', () => {
  it('uses server winner flags, including ties beyond the seat count, and matches photos by ID', () => {
    const view = buildResultsView(results, election);
    expect(view.map((position) => position.id)).toEqual(['empty', 'p1']);
    expect(view[1].candidates.map((candidate) => candidate.candidateId)).toEqual(['a', 'b']);
    expect(view[1].candidates.every((candidate) => candidate.winner && candidate.isTie)).toBe(true);
    expect(view[1].candidates[0].photoUrl).toBe('https://example.test/a.png');
    expect(view[1].candidates[1].photoUrl).toBeNull();
  });
  it('does not turn zero votes into a winner', () => {
    const zero = { ...results, positions: [{ ...results.positions[0], results: [{ ...results.positions[0].results[0], votes: 0, percent: 0, winner: false, isTie: false }] }] };
    expect(buildResultsView(zero, election)[0].candidates[0].winner).toBe(false);
  });
  it('encodes links and displays publication times in Lagos', () => {
    expect(resultsHref('amsul', 'space id')).toBe('/amsul/elections/space%20id/results');
    expect(publishedDate('2026-10-13T12:00:00Z')).toContain('13:00');
    expect(publishedDate('2026-10-13T12:00:00Z')).toContain('WAT');
  });
});
