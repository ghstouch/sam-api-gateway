// ─── Gateway API Keys CRUD ───
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { listGatewayKeys, generateGatewayKey, revokeGatewayKey, toggleGatewayKey, batchImportGatewayKeys } from '@/lib/gateway-keys';

export async function GET(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const keys = listGatewayKeys();
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, rate_limit, allowed_providers, batch } = await req.json();

  // Batch import
  if (batch && Array.isArray(batch)) {
    const result = batchImportGatewayKeys(batch);
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 201 });
  }

  if (!name) return NextResponse.json({ error: 'Missing key name' }, { status: 400 });
  const key = generateGatewayKey(name, rate_limit || 0, allowed_providers || []);
  return NextResponse.json({ key }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { key } = await req.json();
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  const ok = revokeGatewayKey(key);
  return NextResponse.json({ deleted: ok });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { key } = await req.json();
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  const result = toggleGatewayKey(key);
  if (!result) return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  return NextResponse.json({ key: result });
}
