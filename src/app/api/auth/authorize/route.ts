// ─── OAuth Initiate ───
import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';
import { randomUUID } from 'crypto';

export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get('provider');
  if (!providerId || !PROVIDERS[providerId]) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  const provider = PROVIDERS[providerId];
  if (!provider.oauth) {
    return NextResponse.json({ error: 'Provider does not support OAuth' }, { status: 400 });
  }

  const clientId = process.env[provider.oauth.clientIdEnv] || '';
  const redirectUri = `${req.nextUrl.origin}${provider.oauth.redirectPath}`;
  const state = randomUUID();

  const authUrl = new URL(provider.oauth.authorizeUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', provider.oauth.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline'); // Get refresh token
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(authUrl.toString());
}
