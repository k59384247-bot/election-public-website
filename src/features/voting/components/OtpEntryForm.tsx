'use client';

import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useParams } from 'next/navigation';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE, type ClientErrorCode } from '@/lib/errors';
import { useVotingSession } from '../VotingSessionContext';
import { useRequireStep } from '../guards/requireStep';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;

function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 0) return email;
  const visible = email.slice(0, Math.min(3, atIndex));
  return `${visible}......${email.slice(atIndex)}`;
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCooldown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Screen 3 (Verify Email Page). Renders as the center card of VoteFlowLayout's first row. */
export function OtpEntryForm() {
  useRequireStep(['otp_pending']);
  const { electionId } = useParams<{ electionId: string }>();
  const { state, submitIdentity, submitOtpAndExchangeToken, otpExpiresInSeconds, otpSendCount } =
    useVotingSession();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyErrorCode, setVerifyErrorCode] = useState<ClientErrorCode | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendErrorCode, setResendErrorCode] = useState<ClientErrorCode | null>(null);
  // Reset during render (not an effect) whenever a new OTP was actually
  // sent — keyed on otpSendCount, NOT otpExpiresInSeconds, because a resend
  // that returns the same TTL as before (e.g. always 300) wouldn't be
  // detected by comparing the seconds value itself. React's documented
  // pattern for adjusting state on a prop change without an extra render
  // round-trip.
  const [countdownGeneration, setCountdownGeneration] = useState(otpSendCount);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(otpExpiresInSeconds);
  if (otpSendCount !== countdownGeneration) {
    setCountdownGeneration(otpSendCount);
    setSecondsLeft(otpExpiresInSeconds);
  }

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Only restarts the interval when a new countdown actually begins — the
  // per-second setState happens inside the interval's own callback, not
  // synchronously in the effect body.
  useEffect(() => {
    if (otpExpiresInSeconds === null) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [countdownGeneration, otpExpiresInSeconds]);

  // Local to this screen, not the reducer/session — a resend-spam guard
  // only, independent of the server's own RATE_LIMITED enforcement.
  // resendGeneration is bumped only when a resend actually SUCCEEDS: a
  // failed attempt (network error, RATE_LIMITED, ...) shouldn't cost the
  // user the 30s wait on top of whatever already went wrong. Mirrors the
  // countdownGeneration/secondsLeft pair above: resendCooldownGeneration
  // is the synced copy that the effect keys off, corrected during render
  // (not inside the effect) whenever resendGeneration moves ahead of it.
  const [resendGeneration, setResendGeneration] = useState(0);
  const [resendCooldownGeneration, setResendCooldownGeneration] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState<number | null>(null);
  if (resendGeneration !== resendCooldownGeneration) {
    setResendCooldownGeneration(resendGeneration);
    setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  useEffect(() => {
    if (resendCooldownGeneration === 0) return;
    const id = setInterval(() => {
      setResendSecondsLeft((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldownGeneration]);

  const matricNumber = state.matricNumber ?? '';
  const email = state.email ?? '';

  function applyDigitsFrom(startIndex: number, value: string) {
    const chars = value.replace(/\D/g, '').slice(0, OTP_LENGTH - startIndex).split('');
    if (chars.length === 0) return;

    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((char, offset) => {
        next[startIndex + offset] = char;
      });
      return next;
    });

    const nextIndex = Math.min(startIndex + chars.length, OTP_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  }

  function handleDigitChange(index: number, rawValue: string) {
    const digitsOnly = rawValue.replace(/\D/g, '');

    if (digitsOnly.length === 0) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (digitsOnly.length === 1) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = digitsOnly;
        return next;
      });
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      return;
    }

    // Multiple characters landed in one box at once — either a paste that
    // wasn't intercepted by onPaste, or SMS/one-time-code autofill.
    applyDigitsFrom(index, digitsOnly);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length > 1) {
      event.preventDefault();
      applyDigitsFrom(index, pasted);
    }
  }

  const otp = digits.join('');
  const isComplete = otp.length === OTP_LENGTH;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting || !isComplete) return;

    setVerifyErrorCode(null);
    setIsSubmitting(true);
    try {
      await submitOtpAndExchangeToken(electionId, matricNumber, otp);
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : NETWORK_ERROR_CODE;
      setVerifyErrorCode(code);
      // Wrong or expired code needs re-entry; rate-limit/network don't.
      if (code === 'INVALID_OTP' || code === 'OTP_EXPIRED') {
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending || (resendSecondsLeft !== null && resendSecondsLeft > 0)) return;
    setResendErrorCode(null);
    setIsResending(true);
    try {
      await submitIdentity(electionId, matricNumber, email);
      setVerifyErrorCode(null);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      setResendGeneration((generation) => generation + 1);
    } catch (err) {
      setResendErrorCode(err instanceof ApiRequestError ? err.code : NETWORK_ERROR_CODE);
    } finally {
      setIsResending(false);
    }
  }

  const verifyDescriptor = verifyErrorCode
    ? getErrorDescriptor(verifyErrorCode, 'otp_verification')
    : null;
  const resendDescriptor = resendErrorCode ? getErrorDescriptor(resendErrorCode) : null;
  const isExpired = verifyErrorCode === 'OTP_EXPIRED';

  return (
    <section className="verify__col card verify-email" aria-labelledby="verify-email-title">
      <div className="verify-email__body">
        <div className="verify-email__intro">
          <h2 className="card__title" id="verify-email-title">
            Verify your EMAIL
          </h2>
          <p className="verify-email__subtitle">
            We&apos;ve sent a six-digit verification code to your registered email address.
            Enter the code below to continue.
          </p>
        </div>

        <form className="verify-email__section" onSubmit={handleSubmit} noValidate>
          <p className="verify-email__email">{maskEmail(email)}</p>

          <div className="verify-email__otp">
            <label className="verify-email__otp-label" htmlFor="otp-1">
              OTP
            </label>
            <div
              className="verify-email__inputs"
              role="group"
              aria-label="Six-digit verification code"
            >
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  className="otp-input"
                  id={`otp-${index + 1}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${index + 1}`}
                  value={digit}
                  disabled={isSubmitting}
                  onChange={(event) => handleDigitChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={(event) => handlePaste(index, event)}
                />
              ))}
            </div>
          </div>

          {verifyDescriptor && (
            <p className="field__error-text" role="alert">
              {verifyErrorCode === 'INVALID_OTP'
                ? `${verifyDescriptor.userMessage} (approximately ${state.attemptsRemaining} attempt${
                    state.attemptsRemaining === 1 ? '' : 's'
                  } remaining)`
                : verifyDescriptor.userMessage}
            </p>
          )}

          {resendDescriptor && (
            <p className="field__error-text" role="alert">
              {resendDescriptor.userMessage}
            </p>
          )}

          <div className="verify-email__actions">
            {secondsLeft !== null && !isExpired && (
              <p className="verify-email__meta">
                <span className="verify-email__meta-label">Code expires in:</span>
                <span className="verify-email__meta-value">{formatCountdown(secondsLeft)}</span>
              </p>
            )}

            <button
              className="btn btn--gold"
              type="submit"
              disabled={!isComplete || isSubmitting || secondsLeft === 0}
            >
              {isSubmitting ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <p className="verify-email__meta">
              <span className="verify-email__meta-label">Didn&apos;t receive the code?</span>
              <button
                className="verify-email__resend verify-email__meta-value"
                type="button"
                onClick={handleResend}
                disabled={isResending || (resendSecondsLeft !== null && resendSecondsLeft > 0)}
              >
                {isResending
                  ? 'Resending…'
                  : resendSecondsLeft !== null && resendSecondsLeft > 0
                    ? `Resend Code (${formatCooldown(resendSecondsLeft)})`
                    : 'Resend Code'}
              </button>
            </p>
          </div>
        </form>
      </div>

      <div className="powered-by">
        <p className="powered-by__brand">
          powered by <strong>strukthq</strong>
        </p>
        <p className="powered-by__tagline">Your trusted departmental platform</p>
      </div>
    </section>
  );
}
