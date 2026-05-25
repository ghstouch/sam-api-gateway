// ─── List Models ───
import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';

export async function GET() {
  const allModels: any[] = [];

  for (const [id, provider] of Object.entries(PROVIDERS)) {
    for (const model of provider.models) {
      allModels.push({
        id: model,
        name: `${provider.name}: ${model}`,
        provider: id,
        provider_name: provider.name,
        provider_icon: provider.icon,
        auth_methods: provider.authMethods,
        object: 'model',
      });
    }
  }

  return NextResponse.json({
    object: 'list',
    data: allModels,
    count: allModels.length,
  });
}
