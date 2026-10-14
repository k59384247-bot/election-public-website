'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE, type ClientErrorCode } from '@/lib/errors';
import { useTenant } from '@/features/tenant/TenantContext';
import { useVotingSession } from '../VotingSessionContext';
import { continueEmailLink, previewEmailLink, resumeEmailLink, type EmailLinkPreview } from '../api';
import { clearEmailBrowserToken, createEmailBrowserToken, readEmailBrowserToken } from '../emailLinkStorage';

export function EmailLinkEntryForm({ electionId, token, onUseCode, onReady }: {
  electionId: string;
  token: string | null;
  onUseCode: () => void;
  onReady: () => void;
}) {
  const { tenantId } = useTenant();
  const { acceptEmailLinkSession } = useVotingSession();
  const [preview, setPreview] = useState<EmailLinkPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<ClientErrorCode | null>(null);
  const [browserError, setBrowserError] = useState(false);
  const [retry, setRetry] = useState(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const browserToken = readEmailBrowserToken(tenantId, electionId);
      if (browserToken) {
        try {
          const session = await resumeEmailLink(tenantId, electionId, browserToken);
          if (cancelled) return;
          await acceptEmailLinkSession(electionId, session);
          if (!cancelled) onReady();
          return;
        } catch (error) {
          if (cancelled) return;
          if (!(error instanceof ApiRequestError) || [NETWORK_ERROR_CODE, 'INTERNAL'].includes(error.code)) throw error;
          clearEmailBrowserToken(tenantId, electionId);
          if (!token) throw error;
        }
      }
      if (!token) { if (!cancelled) onUseCode(); return; }
      const result = await previewEmailLink(tenantId, electionId, token);
      if (!cancelled) setPreview(result);
    }
    load().catch((error) => {
      if (!cancelled) setErrorCode(error instanceof ApiRequestError ? error.code : NETWORK_ERROR_CODE);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, electionId, token, retry, acceptEmailLinkSession, onReady, onUseCode]);

  async function handleContinue() {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setErrorCode(null);
    setBrowserError(false);
    let browserToken: string;
    try {
      browserToken = createEmailBrowserToken(tenantId, electionId);
    } catch {
      setBrowserError(true);
      setSubmitting(false);
      inFlight.current = false;
      return;
    }
    try {
      const session = await continueEmailLink(tenantId, electionId, token, browserToken);
      await acceptEmailLinkSession(electionId, session);
      onReady();
    } catch (error) {
      const code = error instanceof ApiRequestError ? error.code : NETWORK_ERROR_CODE;
      setErrorCode(code);
      if (['LINK_INVALID', 'LINK_USED', 'LINK_EXPIRED', 'TOKEN_EXPIRED', 'ALREADY_VOTED'].includes(code)) clearEmailBrowserToken(tenantId, electionId);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  const descriptor = errorCode ? getErrorDescriptor(errorCode) : null;
  const recoverable = errorCode === NETWORK_ERROR_CODE || errorCode === 'INTERNAL';
  return (
    <section className="verify__col card verify-form" aria-labelledby="email-link-title" aria-busy={loading || submitting}>
      <div className="verify-form__body">
        <div className="verify-form__intro">
          <h2 className="card__title" id="email-link-title">
            {loading ? 'Opening your voting session…' : errorCode === 'ALREADY_VOTED' ? 'Your vote is already recorded' : 'Ready to vote?'}
          </h2>
          {preview && <p className="verify-form__subtitle">You are voting as <strong>{preview.voterName}</strong> in {preview.electionTitle}.</p>}
        </div>
        {!loading && (
          <div className="verify-form__actions">
            {descriptor && <p className="field__error-text" role="alert">{descriptor.userMessage}</p>}
            {browserError && <p className="field__error-text" role="alert">This browser could not save your voting session. Use a verification code instead.</p>}
            {preview && errorCode !== 'ALREADY_VOTED' && (
              <>
                <p className="verify-form__note">Press Continue to start your 30-minute session. You can refresh this browser without restarting the timer. Submit before the session or election ends.</p>
                <button className="btn btn--gold" type="button" onClick={handleContinue} disabled={submitting || !preview.canContinue || Boolean(errorCode && !recoverable)}>
                  {submitting ? 'Opening ballot…' : 'Continue'}
                </button>
                {!preview.canContinue && <p className="verify-form__note">Voting is not open yet. Your link has not been used.</p>}
              </>
            )}
            {recoverable && !preview && <button className="btn btn--gold" type="button" onClick={() => { setErrorCode(null); setLoading(true); setRetry((value) => value + 1); }}>Try again</button>}
            <button className="btn" type="button" onClick={() => { clearEmailBrowserToken(tenantId, electionId); onUseCode(); }} disabled={submitting}>Use a verification code instead</button>
            <p className="verify-form__note">This link is personal. Do not share it.</p>
          </div>
        )}
      </div>
    </section>
  );
}
