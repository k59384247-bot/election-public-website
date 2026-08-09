'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';
import { signInWithCustomToken, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor } from '@/lib/errors';
import {
  initialVotingSessionState,
  votingSessionReducer,
  type OtpFailureCode,
  type VotingSessionAction,
  type VotingSessionState,
} from './votingSessionReducer';
import { validateVoter, verifyOtp } from './api';

const OTP_FAILURE_CODES: readonly string[] = ['INVALID_OTP', 'OTP_LOCKED', 'OTP_EXPIRED'];

function isOtpFailureCode(code: string): code is OtpFailureCode {
  return OTP_FAILURE_CODES.includes(code);
}

export interface VotingSessionContextValue {
  state: VotingSessionState;
  dispatch: Dispatch<VotingSessionAction>;
  submitIdentity: (electionId: string, matricNumber: string, email: string) => Promise<void>;
  submitOtpAndExchangeToken: (electionId: string, matricNumber: string, otp: string) => Promise<void>;
  /**
   * Returns a freshly-minted Firebase ID token for the current voter,
   * refreshed at call time. cast-vote MUST use this rather than the
   * state.idToken captured at OTP-verify time: that frozen string can be
   * well over Firebase's 1-hour expiry by the time the voter reaches
   * "Submit Vote" (ballot paging + review), and the server rejects an
   * expired token with a 401. Throws if there is no live auth session.
   */
  getFreshIdToken: () => Promise<string>;
  reset: () => void;
  /**
   * Not part of the reducer's state machine (it gates no transition) — just
   * the OTP-expiry countdown from validate-voter's response, refreshed by
   * both the initial submit and the OTP screen's resend (same function).
   */
  otpExpiresInSeconds: number | null;
  /**
   * Increments every time submitIdentity succeeds (initial send or resend).
   * The OTP screen's countdown must restart on resend even when the server
   * returns the same expiresInSeconds value as before (e.g. always 300) —
   * comparing otpExpiresInSeconds alone can't detect that a new send just
   * happened, so this generation counter is what the countdown actually
   * keys its reset off of.
   */
  otpSendCount: number;
  /**
   * Also not reducer state — OTP_LOCKED clears the reducer back to idle
   * immediately, which unmounts the OTP screen before it could show why.
   * This carries that one-time explanation to whatever renders next (the
   * identity form) so the "show a message explaining why" requirement
   * still lands on the user, just one screen later.
   */
  lockoutNotice: string | null;
  dismissLockoutNotice: () => void;
}

const VotingSessionContext = createContext<VotingSessionContextValue | null>(null);

export function VotingSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(votingSessionReducer, initialVotingSessionState);
  const [otpExpiresInSeconds, setOtpExpiresInSeconds] = useState<number | null>(null);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const [lockoutNotice, setLockoutNotice] = useState<string | null>(null);

  const submitIdentity = useCallback(async (electionId: string, matricNumber: string, email: string) => {
    // Failure here has no reducer transition (build spec §8 only defines a
    // success edge out of idle) — the caller catches and shows the
    // VOTER_INELIGIBLE/ALREADY_VOTED/etc. state itself via errors.ts.
    const result = await validateVoter({ electionId, matricNumber, email });
    setOtpExpiresInSeconds(result.expiresInSeconds);
    setOtpSendCount((count) => count + 1);
    // Guarded to a no-op by the reducer when step isn't 'idle' — this same
    // function doubles as the OTP screen's "resend code" action, which
    // still needs the validateVoter() call and the refreshed countdown
    // above without re-triggering the idle -> otp_pending transition.
    dispatch({ type: 'SUBMIT_IDENTITY_SUCCESS', matricNumber, email });
  }, []);

  const submitOtpAndExchangeToken = useCallback(async (electionId: string, matricNumber: string, otp: string) => {
    let customToken: string;
    try {
      const result = await verifyOtp({ electionId, matricNumber, otp });
      customToken = result.customToken;
    } catch (err) {
      if (err instanceof ApiRequestError && isOtpFailureCode(err.code)) {
        if (err.code === 'OTP_LOCKED') {
          setLockoutNotice(getErrorDescriptor(err.code).userMessage);
        }
        dispatch({ type: 'VERIFY_OTP_FAILURE', code: err.code });
      }
      // RATE_LIMITED / NETWORK_ERROR / INTERNAL etc. are not modeled by the
      // reducer at all — rethrow so the form shows them locally instead.
      throw err;
    }

    // The custom-token -> ID-token exchange: this phase's riskiest piece.
    // A failure here is a Firebase/auth-layer problem, not a wrong or
    // expired code, so it must not burn an OTP attempt or move the step —
    // just rethrow for the form to show a generic retry.
    const userCredential = await signInWithCustomToken(auth, customToken);
    const idToken = await getIdToken(userCredential.user);
    dispatch({ type: 'VERIFY_OTP_SUCCESS', idToken });
  }, []);

  const getFreshIdToken = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      // Unreachable on the normal path — signInWithCustomToken above
      // established this session and we only signOut on terminal steps — but
      // fail loud instead of sending an empty bearer if the invariant breaks.
      throw new Error('No authenticated voter session');
    }
    // forceRefresh: true — always exchange for a brand-new token rather than
    // trusting the SDK's cached one, so clock skew or a token that expired
    // mid-session can never reach cast-vote's verifyIdToken.
    return getIdToken(user, true);
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    setOtpExpiresInSeconds(null);
    setOtpSendCount(0);
  }, []);

  const dismissLockoutNotice = useCallback(() => {
    setLockoutNotice(null);
  }, []);

  // Build spec §5: no lingering authenticated Firebase session should
  // outlive one voting attempt. Fires once per terminal step reached —
  // fire-and-forget, since there is no recovery UI for a signOut failure at
  // this point (the voting outcome is already final either way).
  useEffect(() => {
    if (state.step === 'voted' || state.step === 'rejected_election_state') {
      void auth.signOut().catch(() => {});
    }
  }, [state.step]);

  const value = useMemo<VotingSessionContextValue>(
    () => ({
      state,
      dispatch,
      submitIdentity,
      submitOtpAndExchangeToken,
      getFreshIdToken,
      reset,
      otpExpiresInSeconds,
      otpSendCount,
      lockoutNotice,
      dismissLockoutNotice,
    }),
    [
      state,
      submitIdentity,
      submitOtpAndExchangeToken,
      getFreshIdToken,
      reset,
      otpExpiresInSeconds,
      otpSendCount,
      lockoutNotice,
      dismissLockoutNotice,
    ]
  );

  return <VotingSessionContext.Provider value={value}>{children}</VotingSessionContext.Provider>;
}

export function useVotingSession(): VotingSessionContextValue {
  const ctx = useContext(VotingSessionContext);
  if (!ctx) {
    throw new Error('useVotingSession must be used within a VotingSessionProvider');
  }
  return ctx;
}
