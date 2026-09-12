import { NextResponse, type NextRequest } from 'next/server';
import { getFreshElectionList } from '@/features/election/server/freshElections';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenantId');
  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenantId is required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const result = await getFreshElectionList(tenantId);

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
