import { describe, expect, it } from 'vitest';
import {
  INITIAL_ATTEMPTS_REMAINING,
  initialVotingSessionState,
  votingSessionReducer,
  type VotingSessionState,
} from './votingSessionReducer';

const otpPendingState: VotingSessionState = {
  step: 'otp_pending',
  matricNumber: '123456789',
  email: 'voter@example.com',
  idToken: null,
  attemptsRemaining: INITIAL_ATTEMPTS_REMAINING,
};

describe('votingSessionReducer', () => {
  it('idle --SUBMIT_IDENTITY_SUCCESS--> otp_pending, storing matric/email for the resend flow', () => {
    const next = votingSessionReducer(initialVotingSessionState, {
      type: 'SUBMIT_IDENTITY_SUCCESS',
      matricNumber: '123456789',
      email: 'voter@example.com',
    });

    expect(next.step).toBe('otp_pending');
    expect(next.matricNumber).toBe('123456789');
    expect(next.email).toBe('voter@example.com');
    expect(next.attemptsRemaining).toBe(INITIAL_ATTEMPTS_REMAINING);
  });

  it('otp_pending --VERIFY_OTP success--> token_acquired, storing the exchanged ID token', () => {
    const next = votingSessionReducer(otpPendingState, {
      type: 'VERIFY_OTP_SUCCESS',
      idToken: 'firebase-id-token',
    });

    expect(next.step).toBe('token_acquired');
    expect(next.idToken).toBe('firebase-id-token');
  });

  it('otp_pending --VERIFY_OTP fails (INVALID_OTP)--> stays otp_pending, decrements attemptsRemaining', () => {
    const next = votingSessionReducer(otpPendingState, {
      type: 'VERIFY_OTP_FAILURE',
      code: 'INVALID_OTP',
    });

    expect(next.step).toBe('otp_pending');
    expect(next.attemptsRemaining).toBe(INITIAL_ATTEMPTS_REMAINING - 1);
    // matric/email must survive an invalid attempt — the user is still on
    // this screen and hasn't lost their identity.
    expect(next.matricNumber).toBe('123456789');
    expect(next.email).toBe('voter@example.com');
  });

  it('attemptsRemaining never drops below zero across repeated INVALID_OTP failures', () => {
    let state = { ...otpPendingState, attemptsRemaining: 1 };
    state = votingSessionReducer(state, { type: 'VERIFY_OTP_FAILURE', code: 'INVALID_OTP' });
    expect(state.attemptsRemaining).toBe(0);

    state = votingSessionReducer(state, { type: 'VERIFY_OTP_FAILURE', code: 'INVALID_OTP' });
    expect(state.attemptsRemaining).toBe(0);
  });

  it('otp_pending --VERIFY_OTP fails (OTP_LOCKED)--> idle, clearing matric/email/token/attempts', () => {
    const dirtyState: VotingSessionState = {
      step: 'otp_pending',
      matricNumber: '123456789',
      email: 'voter@example.com',
      idToken: null,
      attemptsRemaining: 2,
    };

    const next = votingSessionReducer(dirtyState, {
      type: 'VERIFY_OTP_FAILURE',
      code: 'OTP_LOCKED',
    });

    expect(next).toEqual(initialVotingSessionState);
    expect(next.step).toBe('idle');
    expect(next.matricNumber).toBeNull();
    expect(next.email).toBeNull();
  });

  it('otp_pending --VERIFY_OTP fails (OTP_EXPIRED)--> stays otp_pending, matric/email kept for resend', () => {
    const stateWithSomeAttemptsSpent: VotingSessionState = {
      ...otpPendingState,
      attemptsRemaining: 3,
    };

    const next = votingSessionReducer(stateWithSomeAttemptsSpent, {
      type: 'VERIFY_OTP_FAILURE',
      code: 'OTP_EXPIRED',
    });

    expect(next.step).toBe('otp_pending');
    expect(next.matricNumber).toBe('123456789');
    expect(next.email).toBe('voter@example.com');
    // Expiry isn't a wrong guess — it must not burn an attempt.
    expect(next.attemptsRemaining).toBe(3);
  });

  it('token_acquired --PROCEED_TO_BALLOT--> ballot_in_progress (no-op stub transition)', () => {
    const tokenAcquiredState: VotingSessionState = {
      step: 'token_acquired',
      matricNumber: '123456789',
      email: 'voter@example.com',
      idToken: 'firebase-id-token',
      attemptsRemaining: INITIAL_ATTEMPTS_REMAINING,
    };

    const next = votingSessionReducer(tokenAcquiredState, { type: 'PROCEED_TO_BALLOT' });

    expect(next.step).toBe('ballot_in_progress');
    expect(next.idToken).toBe('firebase-id-token');
  });

  it('RESET returns to idle and clears matric/email/token/attemptsRemaining from any state', () => {
    const messyState: VotingSessionState = {
      step: 'ballot_in_progress',
      matricNumber: '123456789',
      email: 'voter@example.com',
      idToken: 'firebase-id-token',
      attemptsRemaining: 1,
    };

    const next = votingSessionReducer(messyState, { type: 'RESET' });

    expect(next).toEqual(initialVotingSessionState);
  });

  describe('guards against out-of-order actions', () => {
    it('ignores VERIFY_OTP_SUCCESS when not in otp_pending', () => {
      const next = votingSessionReducer(initialVotingSessionState, {
        type: 'VERIFY_OTP_SUCCESS',
        idToken: 'should-not-apply',
      });

      expect(next).toEqual(initialVotingSessionState);
    });

    it('ignores SUBMIT_IDENTITY_SUCCESS when not in idle (e.g. a resend while otp_pending)', () => {
      const next = votingSessionReducer(otpPendingState, {
        type: 'SUBMIT_IDENTITY_SUCCESS',
        matricNumber: '999999999',
        email: 'other@example.com',
      });

      // Step-machine-wise this is a no-op: still otp_pending with the
      // original identity, even though a resend's validateVoter() call
      // happened at the API layer outside the reducer.
      expect(next).toEqual(otpPendingState);
    });

    it('ignores PROCEED_TO_BALLOT when not in token_acquired', () => {
      const next = votingSessionReducer(otpPendingState, { type: 'PROCEED_TO_BALLOT' });
      expect(next).toEqual(otpPendingState);
    });
  });
});
