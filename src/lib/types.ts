/**
 * Shared API types for the election data layer.
 * No React/JSX imports belong in this file.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface ApiSuccess<T, M = undefined> {
  success: true;
  data: T;
  meta?: M;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export type ApiEnvelope<T, M = undefined> = ApiSuccess<T, M> | ApiFailure;

// ---------------------------------------------------------------------------
// Error catalog
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'INVALID_ARGUMENT'
  | 'VALIDATION_ERROR'
  | 'DUPLICATE_VOTE'
  | 'TOO_MANY_VOTES_FOR_POSITION'
  | 'INVALID_CANDIDATE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VOTER_INELIGIBLE'
  | 'ALREADY_VOTED'
  | 'ELECTION_CLOSED'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'OTP_LOCKED'
  | 'INVALID_TENANT'
  | 'TENANT_NOT_FOUND'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL';

// ---------------------------------------------------------------------------
// Elections
// ---------------------------------------------------------------------------

export type PublicElectionStatus =
  | 'voting_open'
  | 'voting_paused'
  | 'voting_closed'
  | 'results_published'
  | 'upcoming';

export interface CandidateSocialLinks {
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  whatsapp?: string;
  [key: string]: string | undefined;
}

export interface Candidate {
  id: string;
  name: string;
  nickname: string | null;
  manifesto: string;
  photoUrl: string | null;
  campaignVideoUrl: string | null;
  manifestoDocumentUrl: string | null;
  socialLinks: CandidateSocialLinks;
}

export interface Position {
  id: string;
  title: string;
  description: string;
  order: number;
  maxVotesPerVoter: number;
  candidates: Candidate[];
}

/** Full election payload — GET /active and GET /:electionId */
export interface Election {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublicElectionStatus;
  startDate: string;
  endDate: string;
  votesCast: number;
  contactEmail: string | null;
  contactWhatsapp: string | null;
  contactPhone: string | null;
  positions: Position[];
}

/**
 * Summary shape for GET /v1/elections (list endpoint, Appendix A).
 * Deliberately excludes positions/candidates — do not reuse `Election` here.
 */
export interface ElectionSummary {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublicElectionStatus;
  startDate: string;
  endDate: string;
  votesCast: number;
}

/** Meta shape attached to paginated list responses. */
export interface PaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
}

// Public tenant configuration returned by GET /v1/tenants/:tenantId/public.
export interface TenantPublicInfo {
  id: string;
  tenantId: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  description: string | null;
}

// ---------------------------------------------------------------------------
// validate-voter
// ---------------------------------------------------------------------------

export interface ValidateVoterRequest {
  electionId: string;
  matricNumber: string;
  email: string;
}

export interface ValidateVoterResponse {
  message: string;
  expiresInSeconds: number;
}

// ---------------------------------------------------------------------------
// verify-otp
// ---------------------------------------------------------------------------

export interface VerifyOtpRequest {
  electionId: string;
  matricNumber: string;
  otp: string;
}

export interface VerifyOtpResponse {
  customToken: string;
  expiresInSeconds: number;
}

// ---------------------------------------------------------------------------
// cast-vote
// ---------------------------------------------------------------------------

export interface CastVoteEntry {
  positionId: string;
  candidateId: string;
}

export interface CastVoteRequest {
  electionId: string;
  votes: CastVoteEntry[];
}

export interface CastVoteResponse {
  message: string;
  receiptCode: string;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface CandidateResult {
  candidateId: string;
  candidateName: string;
  votes: number;
  winner: boolean;
}

export interface PositionResult {
  positionId: string;
  positionTitle: string;
  results: CandidateResult[];
}

export interface ElectionResults {
  electionId: string;
  title: string;
  totalVotesCast: number;
  positions: PositionResult[];
}
