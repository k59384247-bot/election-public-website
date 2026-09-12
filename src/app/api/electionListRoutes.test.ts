import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicElectionStatus } from '@/lib/types';

const TEST_SECRET = 'route-test-secret';
const API_BASE_URL = 'https://elections.example/api/';

function upstreamList(status: PublicElectionStatus): Response {
  return Response.json({
    success: true,
    data: [
      {
        id: 'election-1',
        title: 'Election 1',
        description: 'A test election',
        thumbnailUrl: null,
        status,
        startDate: '2026-09-01T00:00:00.000Z',
        endDate: '2026-09-30T00:00:00.000Z',
        votesCast: 0,
      },
    ],
    meta: { hasMore: false, nextCursor: null },
  });
}

function signedWebhookRequest(eventId: string): Request {
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    eventId,
    tenantId: 'amsul',
    apiBaseUrl: API_BASE_URL,
    version: 2,
    operation: 'status_changed',
    electionId: 'election-1',
    changedAt: timestamp,
  });
  const signature = createHmac('sha256', TEST_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('base64');

  return new Request('https://vote.example/api/webhooks/election-list', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'x-amsul-webhook-id': eventId,
      'x-amsul-webhook-timestamp': timestamp,
      'x-amsul-webhook-signature': `v1=${signature}`,
    },
  });
}

describe('election-list HTTP freshness', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', API_BASE_URL);
    vi.stubEnv('ELECTION_LIST_WEBHOOK_SECRET', TEST_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the changed status after the webhook succeeds, even from an already-warm instance', async () => {
    let upstreamStatus: PublicElectionStatus = 'voting_closed';
    const upstreamFetch = vi.fn<typeof fetch>(async () => upstreamList(upstreamStatus));
    vi.stubGlobal('fetch', upstreamFetch);

    const { NextRequest } = await import('next/server');
    const warmInstance = await import('./elections/route');
    const before = await warmInstance.GET(
      new NextRequest('https://vote.example/api/elections?tenantId=amsul')
    );
    expect(before.headers.get('cache-control')).toBe('no-store');
    expect((await before.json()).data[0].status).toBe('voting_closed');

    upstreamStatus = 'voting_open';
    vi.resetModules();
    const webhookInstance = await import('./webhooks/election-list/route');
    const accepted = await webhookInstance.POST(signedWebhookRequest('amsul-event-2'));
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ accepted: true });

    const after = await warmInstance.GET(
      new NextRequest('https://vote.example/api/elections?tenantId=amsul')
    );
    expect((await after.json()).data[0].status).toBe('voting_open');
    expect(
      upstreamFetch.mock.calls.every(([, init]) => init?.cache === 'no-store')
    ).toBe(true);
    expect(
      upstreamFetch.mock.calls.map(([input]) => new URL(String(input)).toString())
    ).toEqual([
      'https://elections.example/api/v1/elections?limit=50&tenantId=amsul',
      'https://elections.example/api/v1/elections?limit=50&tenantId=amsul',
      'https://elections.example/api/v1/elections?limit=50&tenantId=amsul',
    ]);
  });

  it('returns 503 instead of accepting an upstream HTTP failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            success: true,
            data: [],
            meta: { hasMore: false, nextCursor: null },
          },
          { status: 500 }
        )
      )
    );

    const webhookInstance = await import('./webhooks/election-list/route');
    const response = await webhookInstance.POST(signedWebhookRequest('amsul-event-failure'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unable to refresh election list' });
  });

  it('returns 503 instead of accepting malformed upstream data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => Response.json({ success: true, data: 'not-a-list' }))
    );

    const webhookInstance = await import('./webhooks/election-list/route');
    const response = await webhookInstance.POST(signedWebhookRequest('amsul-event-malformed'));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Unable to refresh election list' });
  });

  it('accepts a duplicate event idempotently without repeating a completed refresh', async () => {
    const upstreamFetch = vi.fn<typeof fetch>(async () => upstreamList('voting_open'));
    vi.stubGlobal('fetch', upstreamFetch);
    const webhookInstance = await import('./webhooks/election-list/route');

    const first = await webhookInstance.POST(signedWebhookRequest('amsul-event-duplicate'));
    const duplicate = await webhookInstance.POST(signedWebhookRequest('amsul-event-duplicate'));

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toEqual({ accepted: true });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});
