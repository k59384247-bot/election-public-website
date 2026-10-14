const PREFIX = 'email-voting-browser:';

function key(tenantId: string, electionId: string): string {
  return `${PREFIX}${tenantId}:${electionId}`;
}

export function readEmailBrowserToken(tenantId: string, electionId: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key(tenantId, electionId));
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function createEmailBrowserToken(tenantId: string, electionId: string): string {
  const existing = readEmailBrowserToken(tenantId, electionId);
  if (existing) return existing;
  const bytes = window.crypto.getRandomValues(new Uint8Array(32));
  const value = window.btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // The proof must survive a lost response or refresh before consuming the link.
  window.sessionStorage.setItem(key(tenantId, electionId), value);
  return value;
}

export function clearEmailBrowserToken(tenantId: string, electionId: string): void {
  try {
    window.sessionStorage.removeItem(key(tenantId, electionId));
  } catch {
    // An unavailable store has no persistent browser session to remove.
  }
}
