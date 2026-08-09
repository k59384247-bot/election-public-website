/**
 * Pure state machine for the voting session (build spec §8). No React,
 * Next.js, or API imports — this file is just state + action types + a
 * reducer function, so it's testable with zero mocking.
 */

export type VotingStep =
  | 'idle'
  | 'otp_pending'
  | 'token_acquired'
  | 'ballot_in_progress'
  | 'submitting'
  | 'voted'
  | 'rejected_election_state';

export const INITIAL_ATTEMPTS_REMAINING = 5;

export interface VotingSessionState {
  step: VotingStep;
  matricNumber: string | null;
  email: string | null;
  /** Exchanged Firebase ID token — never the raw custom token. In memory only. */
  idToken: string | null;
  /**
   * Client-side estimate only (build spec §17 open question) — the API
   * doesn't return a server-confirmed count. Only meaningful in otp_pending.
   */
  attemptsRemaining: number;
  /** Set entering 'voted'. Null on the alreadyVoted success path — the API returns no receipt there. */
  receiptCode: string | null;
  /** Set entering 'voted' — true when castVote() resolved via its ALREADY_VOTED-as-success path. */
  alreadyVoted: boolean;
  /**
   * Set entering 'rejected_election_state'. 'election_state' is a genuine,
   * definitive rejection (ELECTION_CLOSED/FORBIDDEN/malformed ballot — build
   * spec §9.3 step e); 'network' is castVote() giving up after its own
   * retry with no response at all. Kept as a plain string union (not an API
   * error code) so this file stays free of API-layer imports.
   */
  rejectionReason: 'election_state' | 'network' | null;
}

export const initialVotingSessionState: VotingSessionState = {
  step: 'idle',
  matricNumber: null,
  email: null,
  idToken: null,
  attemptsRemaining: INITIAL_ATTEMPTS_REMAINING,
  receiptCode: null,
  alreadyVoted: false,
  rejectionReason: null,
};

/**
 * OTP_EXPIRED stays in otp_pending (matches errors.ts's recoveryAction:
 * 'show_resend') so the resend button can re-call validate-voter with the
 * still-present matricNumber/email. Only OTP_LOCKED forces back to idle.
 */
export type OtpFailureCode = 'INVALID_OTP' | 'OTP_LOCKED' | 'OTP_EXPIRED';

export type VotingSessionAction =
  | { type: 'SUBMIT_IDENTITY_SUCCESS'; matricNumber: string; email: string }
  | { type: 'VERIFY_OTP_SUCCESS'; idToken: string }
  | { type: 'VERIFY_OTP_FAILURE'; code: OtpFailureCode }
  | { type: 'PROCEED_TO_BALLOT' }
  | { type: 'SUBMIT_VOTE' }
  | { type: 'CAST_VOTE_SUCCESS'; receiptCode: string | null; alreadyVoted: boolean }
  | { type: 'CAST_VOTE_FAILURE'; reason: 'election_state' | 'network' }
  | { type: 'RESET' };

export function votingSessionReducer(
  state: VotingSessionState,
  action: VotingSessionAction
): VotingSessionState {
  switch (action.type) {
    case 'SUBMIT_IDENTITY_SUCCESS': {
      if (state.step !== 'idle') return state;
      return {
        ...state,
        step: 'otp_pending',
        matricNumber: action.matricNumber,
        email: action.email,
        attemptsRemaining: INITIAL_ATTEMPTS_REMAINING,
      };
    }

    case 'VERIFY_OTP_SUCCESS': {
      if (state.step !== 'otp_pending') return state;
      return {
        ...state,
        step: 'token_acquired',
        idToken: action.idToken,
      };
    }

    case 'VERIFY_OTP_FAILURE': {
      if (state.step !== 'otp_pending') return state;

      if (action.code === 'OTP_LOCKED') {
        return { ...initialVotingSessionState };
      }

      if (action.code === 'OTP_EXPIRED') {
        return state;
      }

      // INVALID_OTP
      return {
        ...state,
        attemptsRemaining: Math.max(0, state.attemptsRemaining - 1),
      };
    }

    case 'PROCEED_TO_BALLOT': {
      if (state.step !== 'token_acquired') return state;
      return { ...state, step: 'ballot_in_progress' };
    }

    case 'SUBMIT_VOTE': {
      if (state.step !== 'ballot_in_progress') return state;
      return { ...state, step: 'submitting' };
    }

    case 'CAST_VOTE_SUCCESS': {
      if (state.step !== 'submitting') return state;
      return {
        ...state,
        step: 'voted',
        receiptCode: action.receiptCode,
        alreadyVoted: action.alreadyVoted,
      };
    }

    case 'CAST_VOTE_FAILURE': {
      if (state.step !== 'submitting') return state;
      return { ...state, step: 'rejected_election_state', rejectionReason: action.reason };
    }

    case 'RESET':
      return { ...initialVotingSessionState };

    default:
      return state;
  }
}
