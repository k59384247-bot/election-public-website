import { NextResponse } from 'next/server';
import { invalidateAndPrewarmElectionList } from '@/features/election/server/cachedElections';
import {
  verifyElectionListWebhook,
  type ElectionListWebhookPayload,
} from '@/features/election/server/electionListWebhook';

export const runtime = 'nodejs';

const COMPLETED_EVENT_TTL_MS = 15 * 60 * 1_000;
const completedEvents = new Map<string, number>();
const inFlightEvents = new Map<string, Promise<void>>();

function normalizeApiBaseUrl(value: string): string | null {
  try {
    return new URL(value.endsWith('/') ? value : `${value}/`).toString();
  } catch {
    return null;
  }
}

function eventKey(payload: ElectionListWebhookPayload): string {
  return `${payload.tenantId}:${payload.eventId}`;
}

function pruneCompletedEvents(now: number): void {
  for (const [key, completedAt] of completedEvents) {
    if (now - completedAt > COMPLETED_EVENT_TTL_MS) completedEvents.delete(key);
  }
}

async function processEvent(payload: ElectionListWebhookPayload): Promise<void> {
  const now = Date.now();
  pruneCompletedEvents(now);

  const key = eventKey(payload);
  if (completedEvents.has(key)) return;

  const existing = inFlightEvents.get(key);
  if (existing) return existing;

  const pending = invalidateAndPrewarmElectionList(payload.tenantId).then(() => {
    completedEvents.set(key, Date.now());
  });
  inFlightEvents.set(key, pending);
  pending.finally(() => inFlightEvents.delete(key)).catch(() => {});
  return pending;
}

export async function POST(request: Request) {
  const secret = process.env.ELECTION_LIST_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[election-list-webhook] ELECTION_LIST_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read webhook body' }, { status: 400 });
  }

  const verification = verifyElectionListWebhook({
    rawBody,
    secret,
    webhookIdHeader: request.headers.get('x-amsul-webhook-id'),
    signatureHeader: request.headers.get('x-amsul-webhook-signature'),
    timestampHeader: request.headers.get('x-amsul-webhook-timestamp'),
  });
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: verification.status });
  }

  if (verification.payload.apiBaseUrl) {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (
      !configuredBaseUrl ||
      normalizeApiBaseUrl(verification.payload.apiBaseUrl) !== normalizeApiBaseUrl(configuredBaseUrl)
    ) {
      return NextResponse.json({ error: 'Webhook API base URL is not allowed' }, { status: 400 });
    }
  }

  try {
    await processEvent(verification.payload);
  } catch (error) {
    console.error('[election-list-webhook] cache invalidation failed:', error);
    return NextResponse.json({ error: 'Unable to refresh election list cache' }, { status: 503 });
  }

  return NextResponse.json({ accepted: true });
}
