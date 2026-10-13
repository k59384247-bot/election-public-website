import type { Election, ElectionResults, CandidateResult } from '@/lib/types';

export interface ResultCandidate extends CandidateResult { photoUrl: string | null; }
export interface ResultPosition {
  id: string; title: string; seats: number; order: number; candidates: ResultCandidate[];
}

export function buildResultsView(results: ElectionResults, election: Election): ResultPosition[] {
  return results.positions.map((position) => {
    const configured = election.positions.find((item) => item.id === position.positionId);
    return {
      id: position.positionId, title: position.positionTitle || configured?.title || 'Position',
      seats: position.maxVotesPerVoter || configured?.maxVotesPerVoter || 1,
      order: position.order ?? configured?.order ?? 0,
      candidates: [...position.results].map((candidate) => ({ ...candidate,
        candidateName: candidate.candidateName || configured?.candidates.find((item) => item.id === candidate.candidateId)?.name || 'Candidate',
        photoUrl: configured?.candidates.find((item) => item.id === candidate.candidateId)?.photoUrl ?? null,
      })).sort((a, b) => b.votes - a.votes || a.candidateId.localeCompare(b.candidateId)),
    };
  }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function resultsHref(tenantId: string, electionId: string): string {
  return `/${encodeURIComponent(tenantId)}/elections/${encodeURIComponent(electionId)}/results`;
}

export function publishedDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(new Date(value)) + ' WAT';
}
