// ─── Provider Config (public info) ───
import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';

export async function GET() {
  const providers = Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    name: p.name,
    icon: p.icon,
    models: p.models,
    authMethods: p.authMethods,
    hasOAuth: !!p.oauth,
  }));
  return NextResponse.json({ providers });
}
