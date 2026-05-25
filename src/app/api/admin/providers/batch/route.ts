// ─── Batch Import API Keys ───
import { NextRequest, NextResponse } from 'next/server';
import { getAuthFromRequest } from '@/lib/auth';
import { batchImportApiKeys, BatchApiKey } from '@/lib/oauth-store';

export async function POST(req: NextRequest) {
  if (!(await getAuthFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { keys, format } = await req.json();

  // Support JSON array
  if (Array.isArray(keys)) {
    const result = await batchImportApiKeys(keys as BatchApiKey[]);
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 201 });
  }

  // Support text/csv format: "name,provider,apiKey,priority,rateLimit"
  if (format === 'csv' && typeof keys === 'string') {
    const lines = keys.trim().split('\n').filter(l => l.trim());
    const parsed: BatchApiKey[] = [];

    for (const line of lines) {
      // Skip header row
      if (line.toLowerCase().includes('name') && line.toLowerCase().includes('provider')) continue;

      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        parsed.push({
          name: parts[0],
          provider: parts[1],
          apiKey: parts[2],
          priority: parts[3] ? parseInt(parts[3]) : undefined,
          rateLimit: parts[4] ? parseInt(parts[4]) : undefined,
        });
      }
    }

    const result = await batchImportApiKeys(parsed);
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 201 });
  }

  // Support newline-separated: "name|provider|apiKey"
  if (format === 'lines' && typeof keys === 'string') {
    const lines = keys.trim().split('\n').filter(l => l.trim());
    const parsed: BatchApiKey[] = [];

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        parsed.push({
          name: parts[0],
          provider: parts[1],
          apiKey: parts[2],
          priority: parts[3] ? parseInt(parts[3]) : undefined,
          rateLimit: parts[4] ? parseInt(parts[4]) : undefined,
        });
      }
    }

    const result = await batchImportApiKeys(parsed);
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 201 });
  }

  return NextResponse.json({ error: 'Invalid format. Use {keys: [...]} or {format: "csv", keys: "..."} or {format: "lines", keys: "..."}' }, { status: 400 });
}
