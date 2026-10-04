'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE, type ClientErrorCode } from '@/lib/errors';
import type { Election, RegistrationField } from '@/lib/types';
import { useVotingSession } from '../VotingSessionContext';
import { useRequireStep } from '../guards/requireStep';
import { useTenant } from '@/features/tenant/TenantContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type RegistrationValue = string | number | boolean;
type RegistrationValues = Record<string, RegistrationValue | undefined>;

interface PublicRegistrationFormProps {
  election: Election;
}

function initialValues(fields: RegistrationField[]): RegistrationValues {
  return Object.fromEntries(fields.map((field) => [field.key, field.type === 'checkbox' ? false : '']));
}

function fieldInputValue(field: RegistrationField, value: RegistrationValue | undefined): string | number {
  if (value === undefined || typeof value === 'boolean') return '';
  return value;
}

function validateRegistration(
  fields: RegistrationField[],
  values: RegistrationValues
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.key];

    if (field.type === 'checkbox') {
      if (value !== true) errors[field.key] = `Confirm ${field.label.toLowerCase()}.`;
      continue;
    }

    if (value === undefined || String(value).trim() === '') {
      errors[field.key] = `Enter your ${field.label.toLowerCase()}.`;
      continue;
    }

    if (field.type === 'email' || field.key === 'email') {
      if (!EMAIL_PATTERN.test(String(value).trim())) {
        errors[field.key] = 'Enter a valid email address.';
      }
    }

    if (field.type === 'number') {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) errors[field.key] = `Enter a valid ${field.label.toLowerCase()}.`;
    }

    if (field.type === 'select' && (!field.options || !field.options.includes(String(value)))) {
      errors[field.key] = `Select a valid ${field.label.toLowerCase()}.`;
    }
  }

  return errors;
}

function normalizeRegistrationData(
  fields: RegistrationField[],
  values: RegistrationValues
): Record<string, string | number | boolean> {
  const data: Record<string, string | number | boolean> = {};
  for (const field of fields) {
    const value = values[field.key];
    data[field.key] = field.type === 'number' ? Number(value) : (value as RegistrationValue);
  }
  return data;
}

function PublicRegistrationField({
  field,
  value,
  error,
  onChange,
  disabled,
}: {
  field: RegistrationField;
  value: RegistrationValue | undefined;
  error?: string;
  onChange: (value: RegistrationValue) => void;
  disabled: boolean;
}) {
  const inputId = `registration-field-${field.id}`;
  const fieldClass = error ? 'field field--error' : 'field';

  if (field.type === 'checkbox') {
    return (
      <div className={fieldClass}>
        <div className="registration-checkbox">
          <input
            id={inputId}
            name={field.key}
            type="checkbox"
            required
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
          />
          <label className="field__label" htmlFor={inputId}>
            {field.label}
          </label>
        </div>
        {error && <p className="field__error-text">{error}</p>}
      </div>
    );
  }

  return (
    <div className={fieldClass}>
      <label className="field__label" htmlFor={inputId}>
        {field.label}
      </label>
      <div className="field__control">
        {field.type === 'select' ? (
          <select
            className="field__input"
            id={inputId}
            name={field.key}
            required
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          >
            <option value="">Select an option</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="field__input"
            id={inputId}
            name={field.key}
            type={field.type === 'email' || field.key === 'email' ? 'email' : field.type}
            required
            inputMode={field.type === 'number' ? 'numeric' : undefined}
            value={fieldInputValue(field, value)}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
          />
        )}
      </div>
      {error && <p className="field__error-text">{error}</p>}
    </div>
  );
}

export function PublicRegistrationForm({ election }: PublicRegistrationFormProps) {
  useRequireStep(['idle']);
  const { tenantId } = useTenant();
  const { submitPublicRegistration, lockoutNotice, dismissLockoutNotice } = useVotingSession();
  const fields = useMemo(() => election.registrationFields ?? [], [election.registrationFields]);
  const [values, setValues] = useState<RegistrationValues>(() => initialValues(fields));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorCode, setSubmitErrorCode] = useState<ClientErrorCode | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const errors = validateRegistration(fields, values);
    const emailField = fields.find((field) => field.key === 'email');
    if (!emailField) {
      errors.form = 'This election is missing its email registration field. Please contact the electoral committee.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const registrationData = normalizeRegistrationData(fields, values);
    const email = String(registrationData.email).trim();
    setSubmitErrorCode(null);
    setIsSubmitting(true);
    try {
      await submitPublicRegistration(election.id, email, {
        ...registrationData,
        email,
      });
    } catch (error) {
      setSubmitErrorCode(error instanceof ApiRequestError ? error.code : NETWORK_ERROR_CODE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const descriptor = submitErrorCode
    ? getErrorDescriptor(submitErrorCode, 'default', 'registration details')
    : null;

  if (submitErrorCode === 'ALREADY_VOTED') {
    return (
      <section className="verify__col card verify-form" aria-labelledby="verify-title">
        <div className="verify-form__body">
          <div className="verify-form__intro">
            <h2 className="card__title" id="verify-title">
              You&apos;ve already voted
            </h2>
            <p className="verify-form__subtitle">
              {getErrorDescriptor('ALREADY_VOTED').userMessage}
            </p>
          </div>
          <Link className="btn btn--gold" href={`/${tenantId}`}>
            Return to Home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="verify__col card verify-form" aria-labelledby="verify-title">
      <div className="verify-form__body">
        <div className="verify-form__intro">
          <h2 className="card__title" id="verify-title">
            Register to vote
          </h2>
          <p className="verify-form__subtitle">
            Enter your details to receive a one-time verification code by email.
          </p>
        </div>

        {lockoutNotice && (
          <p className="field__error-text" role="alert">
            {lockoutNotice}
          </p>
        )}

        <form className="verify-form__fields" onSubmit={handleSubmit} noValidate>
          {fields.map((field) => (
            <PublicRegistrationField
              key={field.id}
              field={field}
              value={values[field.key]}
              error={fieldErrors[field.key]}
              disabled={isSubmitting}
              onChange={(value) => {
                dismissLockoutNotice();
                setValues((current) => ({ ...current, [field.key]: value }));
                setFieldErrors((current) => {
                  const next = { ...current };
                  delete next[field.key];
                  delete next.form;
                  return next;
                });
              }}
            />
          ))}

          {fieldErrors.form && (
            <p className="field__error-text" role="alert">
              {fieldErrors.form}
            </p>
          )}
          {descriptor && (
            <p className="field__error-text" role="alert">
              {descriptor.userMessage}
            </p>
          )}

          <div className="verify-form__actions">
            <p className="verify-form__note">We&apos;ll send a one-time verification code to your email address.</p>
            <button className="btn btn--gold" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Continuing…' : 'Continue'}
            </button>
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
