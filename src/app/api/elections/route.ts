import { NextResponse, type NextRequest } from 'next/server';
import {
  getCachedElectionList,
  retryCachedElectionList,
} from '@/features/election/server/cachedElections';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
  }

  try {
    const result = request.nextUrl.searchParams.get('retry') === '1'
      ? await retryCachedElectionList(tenantId)
      : await getCachedElectionList(tenantId);

    return NextResponse.json(
      {
        ...result.data,
        cacheVersion: result.version,
        refreshError: result.refreshError !== null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[GET /api/elections] server list fetch failed:', error);
    return NextResponse.json(
      { error: 'Unable to load elections' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
