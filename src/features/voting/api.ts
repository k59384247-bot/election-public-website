/**
 * The only module allowed to know that voter validation/OTP verification/
 * vote casting live at POST /v1/elections/validate-voter,
 * POST /v1/elections/verify-otp and POST /v1/elections/cast-vote.
 * apiRequest (Phase 1) already does not retry 4xx business-logic failures —
 * this module doesn't re-implement that.
 */

import { apiRequest, ApiRequestError } from '@/lib/apiClient';
import { NETWORK_ERROR_CODE } from '@/lib/errors';
import type {
  CastVoteEntry,
  CastVoteResponse,
  ValidateVoterResponse,
  VerifyOtpResponse,
} from '@/lib/types';

export interface ValidateVoterParams {
  tenantId: string;
  electionId: string;
  matricNumber: string;
  email: string;
}

export async function validateVoter({
  tenantId,
  electionId,
  matricNumber,
  email,
}: ValidateVoterParams): Promise<ValidateVoterResponse> {
  const { data } = await apiRequest<ValidateVoterResponse>('/v1/elections/validate-voter', {
    method: 'POST',
    tenantId,
    body: { electionId, matricNumber, email },
  });
  return data;
}

export interface VerifyOtpParams {
  tenantId: string;
  electionId: string;
  matricNumber: string;
  otp: string;
}

/**
 * Returns the raw custom token only — the Firebase exchange
 * (signInWithCustomToken + getIdToken) is VotingSessionContext's job, not
 * this module's.
 */
export async function verifyOtp({
  tenantId,
  electionId,
  matricNumber,
  otp,
}: VerifyOtpParams): Promise<VerifyOtpResponse> {
  const { data } = await apiRequest<VerifyOtpResponse>('/v1/elections/verify-otp', {
    method: 'POST',
    tenantId,
    body: { electionId, matricNumber, otp },
  });
  return data;
}

// ---------------------------------------------------------------------------
// cast-vote
// ---------------------------------------------------------------------------

export interface CastVoteSuccess {
  success: true;
  /** null only on the alreadyVoted path — the API returns no receipt there. */
  receiptCode: string | null;
  /**
   * True when this "success" is actually an idempotent re-submit (the
   * ALREADY_VOTED path below) — the caller should show "your vote was
   * already recorded" copy instead of a fresh-success message, without
   * treating this as an error state.
   */
  alreadyVoted: boolean;
}

/**
 * Thrown only when castVote()'s own extra retry (see below) STILL gets no
 * response at all. Distinct from ApiRequestError so callers don't have to
 * inspect a code string to tell "we genuinely don't know whether this
 * landed" apart from "the server gave us a definitive answer, and the
 * answer is no".
 */
export class CastVoteNetworkError extends Error {
  constructor() {
    super('Unable to reach the server to submit your vote.');
    this.name = 'CastVoteNetworkError';
  }
}

/**
 * Casts a ballot. Build spec §9.3/§11.2 requires more involved retry/error
 * handling here than a normal apiRequest call — do NOT simplify this:
 *
 * 1. apiRequest() already retries transient NETWORK_ERROR/INTERNAL failures
 *    internally (apiClient.ts's own backoff loop) before ever throwing to
 *    us. If it still throws NETWORK_ERROR after exhausting that, we
 *    genuinely don't know whether the vote landed server-side — the request
 *    may have been received and processed with only the *response* lost in
 *    transit. So THIS function retries the whole request exactly once more,
 *    layered on top of (not instead of) apiClient's own retries.
 *
 * 2. An ALREADY_VOTED error code from that retry (or even from the original
 *    call) is NOT an error here — it's a SUCCESS. It means the vote was
 *    already recorded, almost certainly by an earlier attempt whose
 *    response never reached this client (exactly the scenario the retry
 *    above exists to cover). Treating it as a failure would show an error
 *    for a vote that actually succeeded, or worse, invite the voter to
 *    "try again" against an endpoint that will reject every further
 *    attempt. This is the OPPOSITE of Phase 1's errors.ts ALREADY_VOTED
 *    entry, which describes validate-voter's ALREADY_VOTED (a voter trying
 *    to START a new voting session after already voting — genuinely
 *    terminal/informational there). Do not "fix" this to match that table;
 *    they are different endpoints where the same code means different
 *    things, and this cast-vote path is never reached via validate-voter.
 *
 * 3. Any OTHER definitive rejection (ELECTION_CLOSED, FORBIDDEN, malformed
 *    ballot codes such as INVALID_CANDIDATE/TOO_MANY_VOTES_FOR_POSITION,
 *    etc.) is a real error and is rethrown as-is — never retried, never
 *    treated like step 2.
 */
export async function castVote(
  electionId: string,
  votes: CastVoteEntry[],
  idToken: string
): Promise<CastVoteSuccess> {
  const send = () =>
    apiRequest<CastVoteResponse>('/v1/elections/cast-vote', {
      method: 'POST',
      token: idToken,
      body: { electionId, votes },
    });

  try {
    const { data } = await send();
    return { success: true, receiptCode: data.receiptCode, alreadyVoted: false };
  } catch (firstErr) {
    if (!(firstErr instanceof ApiRequestError) || firstErr.code !== NETWORK_ERROR_CODE) {
      if (firstErr instanceof ApiRequestError && firstErr.code === 'ALREADY_VOTED') {
        return { success: true, receiptCode: null, alreadyVoted: true };
      }
      // A definitive rejection on the first attempt — never retried.
      throw firstErr;
    }

    // No response at all on the first attempt — retry the exact same
    // request once more before giving up.
    try {
      const { data } = await send();
      return { success: true, receiptCode: data.receiptCode, alreadyVoted: false };
    } catch (secondErr) {
      if (secondErr instanceof ApiRequestError && secondErr.code === 'ALREADY_VOTED') {
        return { success: true, receiptCode: null, alreadyVoted: true };
      }

      if (secondErr instanceof ApiRequestError && secondErr.code !== NETWORK_ERROR_CODE) {
        throw secondErr;
      }

      // Still no response after the extra retry — genuinely give up.
      throw new CastVoteNetworkError();
    }
  }
}
