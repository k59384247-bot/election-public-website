'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Mail, UserCheck } from 'lucide-react';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE, type ClientErrorCode } from '@/lib/errors';
import { useVotingSession } from '../VotingSessionContext';
import { useRequireStep } from '../guards/requireStep';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  matricNumber?: string;
  email?: string;
}

function validate(matricNumber: string, email: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!matricNumber.trim()) {
    errors.matricNumber = 'Enter your matriculation number.';
  }
  if (!email.trim()) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}

/** Screen 2 (Verify Identity Page). Renders as the center card of VoteFlowLayout's first row. */
export function VerifyIdentityForm() {
  useRequireStep(['idle']);
  const { electionId } = useParams<{ electionId: string }>();
  const { submitIdentity, lockoutNotice, dismissLockoutNotice } = useVotingSession();

  const [matricNumber, setMatricNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState<ClientErrorCode | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validate(matricNumber, email);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitErrorCode(null);
    setIsSubmitting(true);
    try {
      await submitIdentity(electionId, matricNumber.trim(), email.trim());
    } catch (err) {
      // VOTER_INELIGIBLE stays generic here on purpose — the server never
      // says whether matric or email was wrong, so neither field is flagged.
      setSubmitErrorCode(err instanceof ApiRequestError ? err.code : NETWORK_ERROR_CODE);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ALREADY_VOTED is terminal for this form — no dedicated screen exists in
  // the 8-screen inventory, so this routes back toward Home with a message.
  if (submitErrorCode === 'ALREADY_VOTED') {
    const descriptor = getErrorDescriptor(submitErrorCode);
    return (
      <section className="verify__col card verify-form" aria-labelledby="verify-title">
        <div className="verify-form__body">
          <div className="verify-form__intro">
            <h2 className="card__title" id="verify-title">
              You&apos;ve already voted
            </h2>
            <p className="verify-form__subtitle">{descriptor.userMessage}</p>
          </div>
          <Link className="btn btn--gold" href="/">
            Return to Home
          </Link>
        </div>
      </section>
    );
  }

  const descriptor = submitErrorCode ? getErrorDescriptor(submitErrorCode) : null;

  return (
    <section className="verify__col card verify-form" aria-labelledby="verify-title">
      <div className="verify-form__body">
        <div className="verify-form__intro">
          <h2 className="card__title" id="verify-title">
            Verify your identity
          </h2>
          <p className="verify-form__subtitle">
            Please verify your matric number and registered email address that matches
            the information registered with the Electoral Committee.
          </p>
        </div>

        {lockoutNotice && (
          <p className="field__error-text" role="alert">
            {lockoutNotice}
          </p>
        )}

        <form className="verify-form__fields" onSubmit={handleSubmit} noValidate>
          <div className={fieldErrors.matricNumber ? 'field field--error' : 'field'}>
            <label className="field__label" htmlFor="matric">
              Matriculation Number
            </label>
            <div className="field__control">
              <UserCheck
                className="field__icon"
                style={{ color: 'var(--color-wine)' }}
                aria-hidden="true"
              />
              <input
                className="field__input"
                id="matric"
                name="matric"
                type="text"
                inputMode="numeric"
                placeholder="123456789"
                autoComplete="off"
                value={matricNumber}
                onChange={(event) => {
                  setMatricNumber(event.target.value);
                  dismissLockoutNotice();
                }}
                disabled={isSubmitting}
              />
            </div>
            {fieldErrors.matricNumber && (
              <p className="field__error-text">{fieldErrors.matricNumber}</p>
            )}
          </div>

          <div className={fieldErrors.email ? 'field field--error' : 'field'}>
            <label className="field__label" htmlFor="email">
              Email Address
            </label>
            <div className="field__control">
              <Mail
                className="field__icon"
                style={{ color: 'var(--color-wine)' }}
                aria-hidden="true"
              />
              <input
                className="field__input"
                id="email"
                name="email"
                type="email"
                placeholder="Johndoe@gmail.com"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  dismissLockoutNotice();
                }}
                disabled={isSubmitting}
              />
            </div>
            {fieldErrors.email && <p className="field__error-text">{fieldErrors.email}</p>}
          </div>

          {descriptor && (
            <p className="field__error-text" role="alert">
              {descriptor.userMessage}
            </p>
          )}

          <div className="verify-form__actions">
            <p className="verify-form__note">
              We&apos;ll send a one-time verification code to your email address.
            </p>
            <button className="btn btn--gold" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Verifying…' : 'Continue'}
            </button>
            <p className="verify-form__note">
              Verification takes less than one minute. Need help verifying your details?
              Contact electoral committee below
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
