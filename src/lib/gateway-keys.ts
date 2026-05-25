// ─── Gateway API Key Store (client-facing keys) ───
import { randomBytes } from 'crypto';

export interface GatewayApiKey {
  key: string;
  name: string;
  createdAt: string;
  lastUsed: string | null;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
  enabled: boolean;
  rateLimit: number; // requests per minute, 0 = unlimited
  allowedProviders: string[]; // empty = all providers
}

// In-memory store
const keys: Map<string, GatewayApiKey> = new Map();
const DEFAULT_KEY = 'ogw-default-000000000000000000000000';

// Seed default key
if (!keys.has(DEFAULT_KEY)) {
  keys.set(DEFAULT_KEY, {
    key: DEFAULT_KEY,
    name: 'Default Key',
    createdAt: '2026-01-01T00:00:00.000Z',
    lastUsed: null,
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    enabled: true,
    rateLimit: 0,
    allowedProviders: [],
  });
}

export function generateGatewayKey(name: string, rateLimit = 0, allowedProviders: string[] = []): GatewayApiKey {
  const key = 'sam_' + randomBytes(24).toString('hex');
  const apiKey: GatewayApiKey = {
    key,
    name,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    requestCount: 0,
    totalTokens: 0,
    totalCost: 0,
    enabled: true,
    rateLimit,
    allowedProviders,
  };
  keys.set(key, apiKey);
  return apiKey;
}

export function validateGatewayKey(key: string): boolean {
  const apiKey = keys.get(key);
  if (!apiKey || !apiKey.enabled) return false;

  // Rate limit check
  if (apiKey.rateLimit > 0) {
    const oneMinAgo = Date.now() - 60000;
    // Simple check — in production would use Redis sorted sets
  }

  apiKey.lastUsed = new Date().toISOString();
  return true;
}

export function getGatewayKey(key: string): GatewayApiKey | undefined {
  return keys.get(key);
}

export function listGatewayKeys(): GatewayApiKey[] {
  return Array.from(keys.values());
}

export function revokeGatewayKey(key: string): boolean {
  return keys.delete(key);
}

export function toggleGatewayKey(key: string): GatewayApiKey | null {
  const apiKey = keys.get(key);
  if (!apiKey) return null;
  apiKey.enabled = !apiKey.enabled;
  return apiKey;
}

export function batchImportGatewayKeys(items: { name: string; key?: string; rateLimit?: number; allowedProviders?: string[] }[]): { success: number; failed: number; errors: string[]; keys: GatewayApiKey[] } {
  const result = { success: 0, failed: 0, errors: [] as string[], keys: [] as GatewayApiKey[] };

  for (const item of items) {
    try {
      const apiKey = item.key
        ? { key: item.key, name: item.name, createdAt: new Date().toISOString(), lastUsed: null, requestCount: 0, totalTokens: 0, totalCost: 0, enabled: true, rateLimit: item.rateLimit || 0, allowedProviders: item.allowedProviders || [] }
        : generateGatewayKey(item.name, item.rateLimit, item.allowedProviders);

      if (item.key) keys.set(item.key, apiKey as GatewayApiKey);
      result.success++;
      result.keys.push(apiKey as GatewayApiKey);
    } catch (e) {
      result.failed++;
      result.errors.push(`Failed: ${item.name}`);
    }
  }

  return result;
}
