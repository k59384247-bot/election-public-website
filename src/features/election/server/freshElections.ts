import 'server-only';

import { loadElectionListFromApi } from './upstream';

function configuredApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!configured) throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured');
  return new URL(configured.endsWith('/') ? configured : `${configured}/`).toString();
}

/**
 * Election status is correctness-sensitive and the deployed OpenNext setup has
 * no globally shared tag cache/purge. Always read it from the source of truth.
 */
export async function getFreshElectionList(
  tenantId: string,
  apiBaseUrl = configuredApiBaseUrl()
) {
  const data = await loadElectionListFromApi({ apiBaseUrl, tenantId });
  return {
    data,
    version: Date.now(),
    isStale: false,
    refreshError: null,
  };
}

/** Block until the dashboard's updated list is readable before acknowledging. */
export function prewarmFreshElectionList(tenantId: string, apiBaseUrl: string) {
  return getFreshElectionList(tenantId, apiBaseUrl);
}
