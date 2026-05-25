// ─── Usage Analytics API ───
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { getUsageStats, getUsageLogs } from '@/lib/oauth-store';

export async function GET(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'all';

  let fromMs: number | undefined;
  const now = Date.now();

  switch (range) {
    case '24h': fromMs = now - 24 * 60 * 60 * 1000; break;
    case '7d': fromMs = now - 7 * 24 * 60 * 60 * 1000; break;
    case '30d': fromMs = now - 30 * 24 * 60 * 60 * 1000; break;
    case '60d': fromMs = now - 60 * 24 * 60 * 60 * 1000; break;
    default: fromMs = undefined;
  }

  const stats = getUsageStats(fromMs);
  const logs = getUsageLogs(fromMs);

  return NextResponse.json({
    range,
    stats,
    recentLogs: logs.slice(-50).reverse(), // Last 50 requests
  });
}
