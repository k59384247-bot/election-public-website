'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE, type ClientErrorCode } from '@/lib/errors';
import { useTenant } from '@/features/tenant/TenantContext';
import { useVotingSession } from '../VotingSessionContext';
import { continueEmailLink, resumeEmailLink, type EmailLinkSession } from '../api';
import { clearEmailBrowserToken, createEmailBrowserToken, readEmailBrowserToken } from '../emailLinkStorage';
import { ElectionBackLink } from './ElectionBackLink';

export function EmailLinkEntryForm({ electionId, token, onUseCode, onReady }: {
  electionId: string;
  token: string | null;
  onUseCode: () => void;
  onReady: () => void;
}) {
  const { tenantId } = useTenant();
  const { acceptEmailLinkSession } = useVotingSession();
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<ClientErrorCode | null>(null);
  const [browserError, setBrowserError] = useState(false);
  const [retry, setRetry] = useState(0);
  const request = useRef<{ scope: string; promise: Promise<EmailLinkSession> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const scope = JSON.stringify([tenantId, electionId, token, retry]);
      if (request.current?.scope !== scope) {
        let browserToken = readEmailBrowserToken(tenantId, electionId);
        if (token) {
          try {
            browserToken = createEmailBrowserToken(tenantId, electionId);
          } catch {
            setBrowserError(true);
            return;
          }
        }
        if (!browserToken) { onUseCode(); return; }
        // Reuse the request during React's effect replay and the proof on network retries.
        request.current = { scope, promise: token
          ? continueEmailLink(tenantId, electionId, token, browserToken)
          : resumeEmailLink(tenantId, electionId, browserToken) };
      }
      const session = await request.current.promise;
      if (cancelled) return;
      await acceptEmailLinkSession(electionId, session);
      if (!cancelled) onReady();
    }
    load().catch((error) => {
      if (cancelled) return;
      const code = error instanceof ApiRequestError ? error.code : NETWORK_ERROR_CODE;
      setErrorCode(code);
      if (['LINK_INVALID', 'LINK_USED', 'LINK_EXPIRED', 'TOKEN_EXPIRED', 'ALREADY_VOTED'].includes(code)) clearEmailBrowserToken(tenantId, electionId);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, electionId, token, retry, acceptEmailLinkSession, onReady, onUseCode]);

  const descriptor = errorCode ? getErrorDescriptor(errorCode) : null;
  const recoverable = errorCode === NETWORK_ERROR_CODE || errorCode === 'INTERNAL';
  const alreadyVoted = errorCode === 'ALREADY_VOTED';
  return (
    <section className={`card status-card${alreadyVoted ? ' status-card--already-voted' : ''}`} aria-labelledby="email-link-title" aria-busy={loading}>
      {alreadyVoted ? (
        <div className="email-link-entry__complete">
          <span className="email-link-entry__badge" aria-hidden="true">
            <Check className="email-link-entry__badge-icon" />
          </span>
          <div className="email-link-entry__copy">
            <h2 className="card__title" id="email-link-title">Your vote is already recorded</h2>
            <p className="email-link-entry__message" role="status">{descriptor?.userMessage}</p>
          </div>
          <ElectionBackLink tenantId={tenantId} className="btn--election-back" label="Back to Election" />
        </div>
      ) : (
        <div className="verify-form__body">
          <div className="verify-form__intro">
            <h2 className="card__title" id="email-link-title">
              {loading ? 'Opening your ballot…' : 'Could not open your ballot'}
            </h2>
            {loading && <p className="verify-form__subtitle" role="status">Your email link is signing you in automatically.</p>}
          </div>
          {!loading && (
            <div className="verify-form__actions">
              {descriptor && <p className="field__error-text" role="alert">{descriptor.userMessage}</p>}
              {browserError && <p className="field__error-text" role="alert">This browser could not save your voting session. Use a verification code instead.</p>}
              {recoverable && <button className="btn btn--gold" type="button" onClick={() => { setErrorCode(null); setLoading(true); setRetry((value) => value + 1); }}>Try again</button>}
              <button className="btn" type="button" onClick={() => { clearEmailBrowserToken(tenantId, electionId); onUseCode(); }}>Use a verification code instead</button>
              <p className="verify-form__note">This link is personal. Do not share it.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
