'use client';

import { ApiRequestError } from '@/lib/apiClient';
import { getErrorDescriptor, NETWORK_ERROR_CODE } from '@/lib/errors';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const code = error instanceof ApiRequestError ? error.code : NETWORK_ERROR_CODE;
  const descriptor = getErrorDescriptor(code);

  return (
    <div className="elections-notice elections-notice--error">
      <h2 className="elections-notice__title">Something went wrong</h2>
      <p className="elections-notice__text">{descriptor.userMessage}</p>
      <button className="elections-notice__retry" type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
