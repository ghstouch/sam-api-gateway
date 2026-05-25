// ─── OAuth Token Management ───
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { listOAuthTokens, deleteOAuthToken } from '@/lib/oauth-store';

export async function GET(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const provider = req.nextUrl.searchParams.get('provider') || undefined;
  const tokens = await listOAuthTokens(provider);
  // Redact access tokens in list view
  const safe = tokens.map(t => ({ ...t, accessToken: t.accessToken.slice(0, 8) + '...', refreshToken: '***' }));
  return NextResponse.json({ tokens: safe });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ok = await deleteOAuthToken(id);
  return NextResponse.json({ deleted: ok });
}
