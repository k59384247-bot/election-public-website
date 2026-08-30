/**
 * Maps API error codes (plus client-side network/timeout failures) to a
 * UI-facing descriptor. This is the single source of truth for how an
 * error code should be surfaced — severity, copy, recovery action.
 *
 * No component should hardcode messaging per ApiErrorCode; always go
 * through `getErrorDescriptor`.
 */

import type { ApiErrorCode } from './types';

/**
 * Client-side error case that never comes from the API body — modeled
 * as its own pseudo-code so callers can branch on a single type.
 */
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR' as const;

export type ClientErrorCode = ApiErrorCode | typeof NETWORK_ERROR_CODE;

export type ErrorSeverity = 'info' | 'warning' | 'error';

export type ErrorRecoveryAction =
  | 'retry'
  | 'redirect_to_start'
  | 'redirect_home'
  | 'show_resend'
  | 'none';

export interface UiErrorDescriptor {
  severity: ErrorSeverity;
  userMessage: string;
  recoveryAction: ErrorRecoveryAction;
}

/**
 * Some codes are ambiguous without knowing which endpoint returned them
 * (e.g. ELECTION_CLOSED means "not published yet" on the results endpoint
 * but "voting isn't open" on validate-voter/cast-vote). `context` lets
 * callers disambiguate; it defaults to 'default' for every other code.
 */
export type ErrorContext = 'default' | 'results' | 'otp_verification';

const DEFAULT_DESCRIPTOR: UiErrorDescriptor = {
  severity: 'error',
  userMessage: 'Something went wrong. Please try again.',
  recoveryAction: 'retry',
};

const BASE_TABLE: Partial<Record<ClientErrorCode, UiErrorDescriptor>> = {
  // Terminal, informational state on validate-voter: the voter already
  // voted, so this is not an error to recover from.
  //
  // NOTE: ALREADY_VOTED returned by cast-vote is a DIFFERENT case and is
  // deliberately NOT handled here. In the voting feature's api.ts
  // (Phase 5), a cast-vote ALREADY_VOTED response is treated as a
  // success (idempotent double-submit), not routed through this table.
  // Do not "fix" that special case to match this entry.
  ALREADY_VOTED: {
    severity: 'info',
    userMessage: 'You have already voted in this election.',
    recoveryAction: 'redirect_home',
  },

  // Intentionally generic: the server does not reveal whether the
  // matric number or the email was the problem, so the UI must not
  // identify one field as incorrect. The recovery hint stays on the
  // identity screen; the OTP screen is only for delivery and resend.
  VOTER_INELIGIBLE: {
    severity: 'error',
    userMessage:
      'We couldn’t verify these details. Check your matric number and registered email, then try again.',
    recoveryAction: 'retry',
  },

  // Too many failed OTP attempts. Force the voter back to the
  // validate-voter step rather than inviting another immediate OTP retry.
  OTP_LOCKED: {
    severity: 'error',
    userMessage:
      'Too many incorrect attempts. Please start the verification process again.',
    recoveryAction: 'redirect_to_start',
  },

  OTP_EXPIRED: {
    severity: 'warning',
    userMessage: 'Your verification code has expired. Request a new one to continue.',
    recoveryAction: 'show_resend',
  },

  // Confirmed against the real API (2026-07-25): the backend returns this
  // same code for BOTH a wrong code and a genuinely expired one — its own
  // message is literally "Invalid or expired OTP". It never distinguishes
  // them, so the UI must not claim confidently that the code was "wrong"
  // (a stale-but-correct code reads identically to a typo here).
  INVALID_OTP: {
    severity: 'error',
    userMessage: "That code didn't work — it may be incorrect or may have expired.",
    recoveryAction: 'retry',
  },

  // Default context: voting isn't currently open. Distinct wording from
  // the results-page case even though it is the same API code — see
  // getErrorDescriptor's 'results' context override below.
  ELECTION_CLOSED: {
    severity: 'warning',
    userMessage: 'Voting is not currently open for this election.',
    recoveryAction: 'none',
  },

  RATE_LIMITED: {
    severity: 'warning',
    userMessage: 'Too many attempts. Please try again shortly.',
    recoveryAction: 'retry',
  },

  // NOT_FOUND is deliberately reused by the backend for several distinct
  // reasons (doesn't exist / wrong tenant / private / draft). The UI must
  // never try to distinguish which — keep the message generic.
  NOT_FOUND: {
    severity: 'info',
    userMessage: 'We could not find what you were looking for.',
    recoveryAction: 'none',
  },

  [NETWORK_ERROR_CODE]: {
    severity: 'warning',
    userMessage: 'We could not reach the server. Check your connection and try again.',
    recoveryAction: 'retry',
  },
};

/** ELECTION_CLOSED as returned by the results endpoint means "not published yet". */
const RESULTS_ELECTION_CLOSED_DESCRIPTOR: UiErrorDescriptor = {
  severity: 'info',
  userMessage: 'Results have not been published yet.',
  recoveryAction: 'none',
};

const OTP_VERIFICATION_NETWORK_DESCRIPTOR: UiErrorDescriptor = {
  severity: 'warning',
  userMessage:
    'We could not reach the server. Check your connection and click Resend Code to request a new verification code.',
  recoveryAction: 'show_resend',
};

export function getErrorDescriptor(
  code: ClientErrorCode,
  context: ErrorContext = 'default'
): UiErrorDescriptor {
  if (code === 'ELECTION_CLOSED' && context === 'results') {
    return RESULTS_ELECTION_CLOSED_DESCRIPTOR;
  }

  if (code === NETWORK_ERROR_CODE && context === 'otp_verification') {
    return OTP_VERIFICATION_NETWORK_DESCRIPTOR;
  }

  return BASE_TABLE[code] ?? DEFAULT_DESCRIPTOR;
}
