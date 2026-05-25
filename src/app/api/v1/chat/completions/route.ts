// ─── Chat Completions Proxy ───
// Routes requests to appropriate provider based on model name

import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';
import { selectProviderAccount, getOAuthToken, refreshOAuthTokenIfNeeded, recordProviderUsage, getProviderAccount } from '@/lib/oauth-store';
import { validateGatewayKey, getGatewayKey } from '@/lib/gateway-keys';

// Detect provider from model name
function detectProvider(model: string): string {
  if (model.startsWith('gemini')) return 'google-gemini';
  if (model.startsWith('kiro')) return 'kiro';
  if (model.startsWith('mimo')) return 'xiaomi-mimo';
  if (model.startsWith('gpt')) return 'openai';
  if (model.startsWith('claude')) return 'anthropic';
  // Default: try all
  return 'openai';
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate gateway key
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: { message: 'Missing Authorization header. Use: Bearer ogw-xxxxx', type: 'auth_error' } },
        { status: 401 }
      );
    }

    const gatewayKey = authHeader.replace('Bearer ', '');
    if (!validateGatewayKey(gatewayKey)) {
      return NextResponse.json(
        { error: { message: 'Invalid or disabled API key', type: 'auth_error' } },
        { status: 401 }
      );
    }

    // 2. Parse request
    const body = await req.text();
    let parsed: { model?: string; messages?: any[] };
    try {
      parsed = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 });
    }

    const model = parsed.model || '';
    const providerId = detectProvider(model);
    const providerConfig = PROVIDERS[providerId];

    if (!providerConfig) {
      return NextResponse.json(
        { error: { message: `Unknown provider for model: ${model}` } },
        { status: 400 }
      );
    }

    // 3. Select provider account (round-robin)
    const account = await selectProviderAccount(providerId);
    if (!account) {
      return NextResponse.json(
        { error: { message: `No active account for provider: ${providerId}` } },
        { status: 503 }
      );
    }

    // 4. Build credentials
    let credentials: Record<string, string> = {};

    if (account.authMethod === 'oauth' && account.oauthTokenId) {
      // Refresh token if needed
      const token = await refreshOAuthTokenIfNeeded(account.oauthTokenId);
      if (!token) {
        return NextResponse.json(
          { error: { message: `OAuth token expired/invalid for: ${account.name}` } },
          { status: 401 }
        );
      }
      credentials = { accessToken: token.accessToken };
    } else {
      credentials = { apiKey: account.apiKey || '' };
    }

    // 5. Build request
    const headers = providerConfig.headers(credentials);
    const upstreamUrl = `${providerConfig.baseUrl}/chat/completions`;

    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body,
    });

    const latencyMs = Date.now() - startTime;
    const contentType = upstreamResp.headers.get('content-type') || '';
    const isStream = contentType.includes('text/event-stream');

    // 6. Handle streaming
    if (isStream) {
      // Estimate tokens for streaming
      let promptEstimate = 0;
      try {
        const msgs = parsed.messages || [];
        promptEstimate = msgs.reduce((acc: number, m: { content?: string }) => acc + (m.content?.length || 0), 0) / 4;
      } catch { /* ignore */ }

      await recordProviderUsage(account.id, {
        model,
        promptTokens: Math.round(promptEstimate),
        completionTokens: 0,
        totalTokens: Math.round(promptEstimate),
        latencyMs,
        status: upstreamResp.status,
      }).catch(() => {});

      return new NextResponse(upstreamResp.body, {
        status: upstreamResp.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 7. Handle JSON response
    const data = await upstreamResp.text();
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    try {
      const parsedResp = JSON.parse(data);
      if (parsedResp.usage) usage = parsedResp.usage;
    } catch { /* ignore */ }

    await recordProviderUsage(account.id, {
      model,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      latencyMs: Date.now() - startTime,
      status: upstreamResp.status,
    }).catch(() => {});

    return new NextResponse(data, {
      status: upstreamResp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Provider': providerId,
        'X-Account': account.name,
        'X-Latency-Ms': String(latencyMs),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error';
    return NextResponse.json(
      { error: { message: msg, type: 'proxy_error' } },
      { status: 502 }
    );
  }
}
