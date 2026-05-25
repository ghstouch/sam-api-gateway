// ─── OAuth Token Management ───
import { randomBytes, randomUUID } from 'crypto';

// ─── Types ───
export interface OAuthToken {
  id: string;
  provider: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  tokenType: string;
  createdAt: string;
  lastRefreshed: string | null;
  refreshCount: number;
  enabled: boolean;
}

export interface ProviderAccount {
  id: string;
  provider: string;
  name: string;
  authMethod: 'apikey' | 'oauth';
  apiKey?: string;
  baseUrl?: string;
  apiType?: string; // chat, responses, embeddings, audio-transcription, audio-speech, images
  oauthTokenId?: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  lastUsed: string | null;
  enabled: boolean;
  priority: number;
  rateLimit: number;
}

export interface UsageRecord {
  id: string;
  accountId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: number;
  timestamp: string;
}

// ─── Redis / In-memory ───
let redis: any = null;
let useRedis = false;

async function getRedis() {
  if (redis !== null) return useRedis ? redis : null;
  try {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      const { Redis } = await import('@upstash/redis');
      redis = new Redis({ url, token });
      useRedis = true;
      return redis;
    }
  } catch (e) {
    console.warn('[oauth-store] Redis init failed:', e);
  }
  redis = undefined;
  return null;
}

// ─── In-memory stores ───
const oauthTokens: Map<string, OAuthToken> = new Map();
const providerAccounts: Map<string, ProviderAccount> = new Map();
const usageLogs: UsageRecord[] = []; // In-memory usage log

// ─── Redis helpers ───
const OAUTH_TOKENS_KEY = 'sam:oauth_tokens';
const PROVIDER_ACCOUNTS_KEY = 'sam:provider_accounts';

async function redisSet(prefix: string, key: string, value: any): Promise<void> {
  const r = await getRedis();
  if (r) {
    await r.set(`${prefix}:${key}`, JSON.stringify(value));
    await r.sadd(`${prefix}:set`, key);
  }
}

async function redisGet(prefix: string, key: string): Promise<any> {
  const r = await getRedis();
  if (!r) return null;
  const data = await r.get(`${prefix}:${key}`);
  return typeof data === 'string' ? JSON.parse(data) : data;
}

async function redisDelete(prefix: string, key: string): Promise<boolean> {
  const r = await getRedis();
  if (!r) return false;
  const existed = await r.exists(`${prefix}:${key}`);
  await r.del(`${prefix}:${key}`);
  await r.srem(`${prefix}:set`, key);
  return existed === 1;
}

async function redisList(prefix: string): Promise<any[]> {
  const r = await getRedis();
  if (!r) return [];
  const keys = await r.smembers(`${prefix}:set`);
  if (!keys || keys.length === 0) return [];
  const pipeline = r.pipeline();
  for (const k of keys) {
    pipeline.get(`${prefix}:${k}`);
  }
  const results = await pipeline.exec();
  return (results || []).filter(Boolean).map((d: any) => typeof d === 'string' ? JSON.parse(d) : d);
}

// ─── OAuth Token CRUD ───

export async function createOAuthToken(data: {
  provider: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType?: string;
}): Promise<OAuthToken> {
  const token: OAuthToken = {
    id: randomUUID(),
    provider: data.provider,
    userId: data.userId,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + (data.expiresIn * 1000),
    scope: data.scope,
    tokenType: data.tokenType || 'Bearer',
    createdAt: new Date().toISOString(),
    lastRefreshed: null,
    refreshCount: 0,
    enabled: true,
  };

  const r = await getRedis();
  if (r) {
    await redisSet(OAUTH_TOKENS_KEY, token.id, token);
  } else {
    oauthTokens.set(token.id, token);
  }
  return token;
}

export async function getOAuthToken(id: string): Promise<OAuthToken | null> {
  const r = await getRedis();
  if (r) return await redisGet(OAUTH_TOKENS_KEY, id);
  return oauthTokens.get(id) || null;
}

export async function listOAuthTokens(provider?: string): Promise<OAuthToken[]> {
  const r = await getRedis();
  let tokens: OAuthToken[];
  if (r) {
    tokens = await redisList(OAUTH_TOKENS_KEY);
  } else {
    tokens = Array.from(oauthTokens.values());
  }
  if (provider) {
    return tokens.filter(t => t.provider === provider);
  }
  return tokens;
}

export async function updateOAuthToken(id: string, updates: Partial<OAuthToken>): Promise<OAuthToken | null> {
  const r = await getRedis();
  let token: OAuthToken | null;
  if (r) {
    token = await redisGet(OAUTH_TOKENS_KEY, id);
  } else {
    token = oauthTokens.get(id) || null;
  }
  if (!token) return null;

  const updated = { ...token, ...updates, id: token.id };
  if (r) {
    await redisSet(OAUTH_TOKENS_KEY, id, updated);
  } else {
    oauthTokens.set(id, updated);
  }
  return updated;
}

export async function deleteOAuthToken(id: string): Promise<boolean> {
  const r = await getRedis();
  if (r) return await redisDelete(OAUTH_TOKENS_KEY, id);
  return oauthTokens.delete(id);
}

// ─── Provider Account CRUD ───

export async function createProviderAccount(data: Omit<ProviderAccount, 'id' | 'requestCount' | 'totalTokens' | 'totalCost' | 'lastUsed'>): Promise<ProviderAccount> {
  const account: ProviderAccount = {
    ...data,
    enabled: data.enabled ?? true,
    id: randomUUID(),
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    lastUsed: null,
  };

  const r = await getRedis();
  if (r) {
    await redisSet(PROVIDER_ACCOUNTS_KEY, account.id, account);
  } else {
    providerAccounts.set(account.id, account);
  }
  return account;
}

export async function getProviderAccount(id: string): Promise<ProviderAccount | null> {
  const r = await getRedis();
  if (r) return await redisGet(PROVIDER_ACCOUNTS_KEY, id);
  return providerAccounts.get(id) || null;
}

export async function listProviderAccounts(provider?: string): Promise<ProviderAccount[]> {
  const r = await getRedis();
  let accounts: ProviderAccount[];
  if (r) {
    accounts = await redisList(PROVIDER_ACCOUNTS_KEY);
  } else {
    accounts = Array.from(providerAccounts.values());
  }
  if (provider) {
    return accounts.filter(a => a.provider === provider).sort((a, b) => a.priority - b.priority);
  }
  return accounts.sort((a, b) => a.priority - b.priority);
}

export async function updateProviderAccount(id: string, updates: Partial<ProviderAccount>): Promise<ProviderAccount | null> {
  const r = await getRedis();
  let account: ProviderAccount | null;
  if (r) {
    account = await redisGet(PROVIDER_ACCOUNTS_KEY, id);
  } else {
    account = providerAccounts.get(id) || null;
  }
  if (!account) return null;

  const updated = { ...account, ...updates, id: account.id };
  if (r) {
    await redisSet(PROVIDER_ACCOUNTS_KEY, id, updated);
  } else {
    providerAccounts.set(id, updated);
  }
  return updated;
}

export async function deleteProviderAccount(id: string): Promise<boolean> {
  const r = await getRedis();
  if (r) return await redisDelete(PROVIDER_ACCOUNTS_KEY, id);
  return providerAccounts.delete(id);
}

// ─── Batch Operations ───

export interface BatchApiKey {
  name: string;
  provider: string;
  apiKey: string;
  priority?: number;
  rateLimit?: number;
}

export interface BatchResult {
  success: number;
  failed: number;
  errors: string[];
  accounts: ProviderAccount[];
}

export async function batchImportApiKeys(keys: BatchApiKey[]): Promise<BatchResult> {
  const result: BatchResult = { success: 0, failed: 0, errors: [], accounts: [] };

  for (const k of keys) {
    try {
      if (!k.name || !k.provider || !k.apiKey) {
        result.failed++;
        result.errors.push(`Missing required field: ${k.name || 'unnamed'}`);
        continue;
      }

      const account = await createProviderAccount({
        provider: k.provider,
        name: k.name,
        authMethod: 'apikey',
        apiKey: k.apiKey,
        priority: k.priority || 0,
        rateLimit: k.rateLimit || 0,
        enabled: true,
      });
      result.success++;
      result.accounts.push(account);
    } catch (e) {
      result.failed++;
      result.errors.push(`Failed to create ${k.name}: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  return result;
}

// ─── Route Selection (pick best available provider account) ───

export async function selectProviderAccount(provider: string): Promise<ProviderAccount | null> {
  const accounts = await listProviderAccounts(provider);
  const enabled = accounts.filter(a => a.enabled);
  if (enabled.length === 0) return null;

  // Round-robin by priority, then by least recently used
  return enabled.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
    const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
    return aTime - bTime;
  })[0];
}

// ─── Usage Recording ───

export async function recordProviderUsage(
  accountId: string,
  usage: { model: string; promptTokens: number; completionTokens: number; totalTokens: number; latencyMs: number; status: number; cost?: number; }
): Promise<void> {
  const account = await getProviderAccount(accountId);
  if (!account) return;

  account.requestCount++;
  account.totalTokens += usage.totalTokens;
  account.totalCost += (usage.cost || 0);
  account.lastUsed = new Date().toISOString();

  // Log usage record
  usageLogs.push({
    id: randomUUID(),
    accountId,
    provider: account.provider,
    model: usage.model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    latencyMs: usage.latencyMs,
    status: usage.status,
    timestamp: new Date().toISOString(),
  });

  // Keep max 10000 records
  if (usageLogs.length > 10000) usageLogs.splice(0, usageLogs.length - 10000);

  const r = await getRedis();
  if (r) {
    await redisSet(PROVIDER_ACCOUNTS_KEY, accountId, account);
  } else {
    providerAccounts.set(accountId, account);
  }
}

// ─── Usage Analytics ───

export function getUsageLogs(fromMs?: number): UsageRecord[] {
  if (!fromMs) return usageLogs;
  return usageLogs.filter(r => new Date(r.timestamp).getTime() >= fromMs);
}

export interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  hourlyRequests: { hour: string; count: number }[];
}

export function getUsageStats(fromMs?: number): UsageStats {
  const logs = fromMs ? usageLogs.filter(r => new Date(r.timestamp).getTime() >= fromMs) : usageLogs;

  const stats: UsageStats = {
    totalRequests: logs.length,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    byProvider: {},
    byModel: {},
    hourlyRequests: [],
  };

  const hourlyMap: Record<string, number> = {};

  for (const r of logs) {
    stats.totalInputTokens += r.promptTokens;
    stats.totalOutputTokens += r.completionTokens;
    stats.totalTokens += r.totalTokens;

    if (!stats.byProvider[r.provider]) stats.byProvider[r.provider] = { requests: 0, tokens: 0, cost: 0 };
    stats.byProvider[r.provider].requests++;
    stats.byProvider[r.provider].tokens += r.totalTokens;

    if (!stats.byModel[r.model]) stats.byModel[r.model] = { requests: 0, tokens: 0, cost: 0 };
    stats.byModel[r.model].requests++;
    stats.byModel[r.model].tokens += r.totalTokens;

    const hour = r.timestamp.slice(0, 13); // YYYY-MM-DDTHH
    hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
  }

  stats.hourlyRequests = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, count]) => ({ hour, count }));

  return stats;
}

// ─── Token Refresh ───

export async function refreshOAuthTokenIfNeeded(tokenId: string): Promise<OAuthToken | null> {
  const token = await getOAuthToken(tokenId);
  if (!token || !token.enabled) return null;

  // Check if expired or about to expire (5 min buffer)
  const needsRefresh = Date.now() > (token.expiresAt - 5 * 60 * 1000);
  if (!needsRefresh) return token;

  // Import provider config
  const { PROVIDERS } = await import('./providers');
  const providerConfig = PROVIDERS[token.provider];
  if (!providerConfig?.oauth) return null;

  try {
    const resp = await fetch(providerConfig.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env[providerConfig.oauth.clientIdEnv] || '',
        client_secret: process.env[providerConfig.oauth.clientSecretEnv] || '',
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!resp.ok) {
      console.error(`[oauth] Refresh failed for ${token.provider}: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const updated = await updateOAuthToken(tokenId, {
      accessToken: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      lastRefreshed: new Date().toISOString(),
      refreshCount: token.refreshCount + 1,
    });

    return updated;
  } catch (e) {
    console.error(`[oauth] Refresh error for ${token.provider}:`, e);
    return null;
  }
}
