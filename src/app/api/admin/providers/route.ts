// ─── Provider Accounts CRUD ───
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { listProviderAccounts, createProviderAccount, deleteProviderAccount, updateProviderAccount } from '@/lib/oauth-store';
import { PROVIDERS } from '@/lib/providers';

export async function GET(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const provider = req.nextUrl.searchParams.get('provider') || undefined;
  const accounts = await listProviderAccounts(provider);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const data = await req.json();
  if (!data.provider || !data.name || !data.authMethod) {
    return NextResponse.json({ error: 'Missing required fields: provider, name, authMethod' }, { status: 400 });
  }
  if (!PROVIDERS[data.provider]) {
    return NextResponse.json({ error: `Unknown provider: ${data.provider}` }, { status: 400 });
  }
  const account = await createProviderAccount(data);
  return NextResponse.json({ account }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ok = await deleteProviderAccount(id);
  return NextResponse.json({ deleted: ok });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...updates } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const account = await updateProviderAccount(id, updates);
  if (!account) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ account });
}
