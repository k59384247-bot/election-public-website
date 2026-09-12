import { createHmac, timingSafeEqual } from 'node:crypto';

export const ELECTION_LIST_WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1_000;
export const ELECTION_LIST_WEBHOOK_MAX_BODY_BYTES = 32 * 1_024;

export interface ElectionListWebhookPayload {
  eventId: string;
  tenantId: string;
  apiBaseUrl: string;
  version?: number;
  operation: string;
  electionId?: string | null;
  changedAt: string;
}

export type ElectionListWebhookVerification =
  | { ok: true; payload: ElectionListWebhookPayload }
  | { ok: false; status: 400 | 401; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isValidTenantId(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function parsePayload(rawBody: string): ElectionListWebhookPayload | null {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.eventId, 256)) return null;
  if (!isNonEmptyString(value.tenantId, 128) || !isValidTenantId(value.tenantId)) return null;
  if (!isNonEmptyString(value.apiBaseUrl, 2_048)) return null;
  try {
    const parsedApiBaseUrl = new URL(value.apiBaseUrl);
    if (parsedApiBaseUrl.protocol !== 'http:' && parsedApiBaseUrl.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  if (
    value.version !== undefined &&
    (typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 0)
  ) {
    return null;
  }
  if (!isNonEmptyString(value.operation, 100)) return null;
  if (!isNonEmptyString(value.changedAt, 64) || Number.isNaN(Date.parse(value.changedAt))) return null;
  if (value.electionId !== undefined && value.electionId !== null && !isNonEmptyString(value.electionId, 256)) {
    return null;
  }

  return {
    eventId: value.eventId,
    tenantId: value.tenantId,
    apiBaseUrl: value.apiBaseUrl,
    version: value.version as number | undefined,
    operation: value.operation,
    electionId: value.electionId as string | null | undefined,
    changedAt: value.changedAt,
  };
}

function signaturesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const receivedBytes = Buffer.from(received, 'utf8');
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export function verifyElectionListWebhook({
  rawBody,
  webhookIdHeader,
  signatureHeader,
  timestampHeader,
  secret,
  now = Date.now(),
}: {
  rawBody: string;
  webhookIdHeader: string | null;
  signatureHeader: string | null;
  timestampHeader: string | null;
  secret: string;
  now?: number;
}): ElectionListWebhookVerification {
  if (Buffer.byteLength(rawBody, 'utf8') > ELECTION_LIST_WEBHOOK_MAX_BODY_BYTES) {
    return { ok: false, status: 400, reason: 'Request body is too large' };
  }

  const payload = parsePayload(rawBody);
  if (!payload) return { ok: false, status: 400, reason: 'Invalid webhook payload' };
  if (!secret) return { ok: false, status: 401, reason: 'Webhook is not configured' };
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, reason: 'Missing webhook authentication' };
  }
  if (!webhookIdHeader || webhookIdHeader !== payload.eventId) {
    return { ok: false, status: 401, reason: 'Webhook id does not match payload' };
  }

  const timestamp = Date.parse(timestampHeader);
  if (Number.isNaN(timestamp) || Math.abs(now - timestamp) > ELECTION_LIST_WEBHOOK_MAX_SKEW_MS) {
    return { ok: false, status: 401, reason: 'Webhook timestamp is invalid or expired' };
  }

  const match = /^v1=([A-Za-z0-9+/=]+)$/.exec(signatureHeader);
  if (!match) return { ok: false, status: 401, reason: 'Webhook signature is invalid' };

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`, 'utf8')
    .digest('base64');
  if (!signaturesMatch(expected, match[1])) {
    return { ok: false, status: 401, reason: 'Webhook signature is invalid' };
  }

  return { ok: true, payload };
}
