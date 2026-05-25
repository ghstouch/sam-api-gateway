// ─── OAuth Callback: kiro ───
import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';
import { createOAuthToken } from '@/lib/oauth-store';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });
  }

  const provider = PROVIDERS['kiro'];
  if (!provider?.oauth) {
    return NextResponse.json({ error: 'Provider not configured for OAuth' }, { status: 400 });
  }

  try {
    // Exchange code for tokens
    const tokenResp = await fetch(provider.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env[provider.oauth.clientIdEnv] || '',
        client_secret: process.env[provider.oauth.clientSecretEnv] || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${req.nextUrl.origin}${provider.oauth.redirectPath}`,
      }),
    });

    if (!tokenResp.ok) {
      const err = await tokenResp.text();
      return NextResponse.json({ error: 'Token exchange failed', details: err }, { status: 500 });
    }

    const tokenData = await tokenResp.json();

    // Store token
    const token = await createOAuthToken({
      provider: 'kiro',
      userId: state || 'default',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || '',
      expiresIn: tokenData.expires_in || 3600,
      scope: tokenData.scope || '',
      tokenType: tokenData.token_type,
    });

    // Return success page
    return new NextResponse(`
      <html><body style="background:#1a1a2e;color:#eee;font-family:sans-serif;text-align:center;padding:50px">
        <h2>✅ OAuth Connected</h2>
        <p>Provider: kiro</p>
        <p>Token ID: ${token.id}</p>
        <p>Expires: ${new Date(token.expiresAt).toLocaleString()}</p>
        <p style="color:#888;margin-top:20px">You can close this window.</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } });
  } catch (e) {
    return NextResponse.json({ error: 'OAuth callback failed', details: String(e) }, { status: 500 });
  }
}
