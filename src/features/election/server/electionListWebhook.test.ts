import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ELECTION_LIST_WEBHOOK_MAX_SKEW_MS,
  verifyElectionListWebhook,
} from './electionListWebhook';

const SECRET = 'test-webhook-secret';
const TIMESTAMP = '2026-09-12T12:00:00.000Z';
const NOW = Date.parse(TIMESTAMP);
const BODY = JSON.stringify({
  eventId: 'amsul-1042',
  tenantId: 'amsul',
  apiBaseUrl: 'https://elections.example/api',
  version: 1042,
  operation: 'status_changed',
  electionId: 'election-1',
  changedAt: TIMESTAMP,
});

function signature(timestamp = TIMESTAMP, body = BODY): string {
  return `v1=${createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('base64')}`;
}

describe('election list webhook verification', () => {
  it('accepts a valid signed payload', () => {
    expect(
      verifyElectionListWebhook({
        rawBody: BODY,
        secret: SECRET,
        webhookIdHeader: 'amsul-1042',
        timestampHeader: TIMESTAMP,
        signatureHeader: signature(),
        now: NOW,
      })
    ).toEqual({
      ok: true,
      payload: {
        eventId: 'amsul-1042',
        tenantId: 'amsul',
        apiBaseUrl: 'https://elections.example/api',
        version: 1042,
        operation: 'status_changed',
        electionId: 'election-1',
        changedAt: TIMESTAMP,
      },
    });
  });

  it('rejects a modified body or invalid signature', () => {
    const result = verifyElectionListWebhook({
      rawBody: BODY.replace('status_changed', 'deleted'),
      secret: SECRET,
      webhookIdHeader: 'amsul-1042',
      timestampHeader: TIMESTAMP,
      signatureHeader: signature(),
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects an expired timestamp', () => {
    const result = verifyElectionListWebhook({
      rawBody: BODY,
      secret: SECRET,
      webhookIdHeader: 'amsul-1042',
      timestampHeader: TIMESTAMP,
      signatureHeader: signature(),
      now: NOW + ELECTION_LIST_WEBHOOK_MAX_SKEW_MS + 1,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects a header id that does not match the signed event id', () => {
    const result = verifyElectionListWebhook({
      rawBody: BODY,
      secret: SECRET,
      webhookIdHeader: 'different-event',
      timestampHeader: TIMESTAMP,
      signatureHeader: signature(),
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('rejects malformed or cross-tenant payloads', () => {
    const malformed = JSON.stringify({ ...JSON.parse(BODY), tenantId: 'AMSUL!' });
    const result = verifyElectionListWebhook({
      rawBody: malformed,
      secret: SECRET,
      webhookIdHeader: 'amsul-1042',
      timestampHeader: TIMESTAMP,
      signatureHeader: signature(TIMESTAMP, malformed),
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('requires the signed payload to provide its API base URL', () => {
    const parsed = JSON.parse(BODY) as Record<string, unknown>;
    delete parsed.apiBaseUrl;
    const bodyWithoutApiBaseUrl = JSON.stringify(parsed);
    const result = verifyElectionListWebhook({
      rawBody: bodyWithoutApiBaseUrl,
      secret: SECRET,
      webhookIdHeader: 'amsul-1042',
      timestampHeader: TIMESTAMP,
      signatureHeader: signature(TIMESTAMP, bodyWithoutApiBaseUrl),
      now: NOW,
    });

    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
