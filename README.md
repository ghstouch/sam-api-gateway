# OGW Gateway — Multi-Provider OAuth API Gateway

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ghstouch/oauth-api-gateway)

## What is this?

An OpenAI-compatible API gateway that manages multiple provider accounts with OAuth 2.0 support. Routes requests to the right provider based on model name, handles token refresh automatically, and provides a full admin dashboard.

## Features

- **Multi-Provider Routing** — Auto-detect provider from model name (gemini → Google, gpt → OpenAI, etc.)
- **OAuth 2.0 Support** — Google Gemini, Google CLI (gcloud), Kiro — auto token refresh
- **Batch API Key Import** — CSV, pipe-separated, or JSON array import
- **Provider Account Management** — Round-robin routing, priority-based selection, enable/disable
- **Gateway API Keys** — Generate client-facing keys with rate limits
- **Usage Tracking** — Per-provider request count, token usage, latency
- **Streaming Support** — Full SSE proxy with proper headers
- **Redis + In-memory** — Upstash Redis for production, in-memory fallback for dev

## Supported Providers

| Provider | Models | API Key | OAuth |
|----------|--------|---------|-------|
| Google Gemini | gemini-pro, gemini-pro-vision, gemini-2.0-flash | ✅ | ✅ (auto-refresh) |
| Google CLI | gemini-pro (gcloud) | ✅ | ✅ |
| Kiro | kiro-v1, kiro-v2 | ✅ | ✅ |
| Xiaomi MiMo | mimo-v2-pro, mimo-v2.5 | ✅ | ❌ |
| OpenAI | gpt-4o, gpt-4o-mini | ✅ | ❌ |
| Anthropic | claude-3.5-sonnet, claude-3-opus | ✅ | ❌ |

## Quick Start

```bash
# Clone
git clone https://github.com/ghstouch/oauth-api-gateway
cd oauth-api-gateway

# Install
npm install

# Configure
cp .env.example .env.local
# Edit .env.local with your credentials

# Run
npm run dev

# Open
# http://localhost:3000
```

## Usage

### Admin Dashboard

Open `http://localhost:3000` → Login with your admin credentials.

**Tabs:**
- 📊 Overview — Stats and provider summary
- 🔌 Providers — Add/remove provider accounts (API key or OAuth)
- 🔑 API Keys — Generate gateway keys for clients
- 🔐 OAuth — Connect OAuth providers, manage tokens
- 📦 Batch Import — Import multiple keys at once

### Batch Import Formats

**CSV:**
```
name,provider,apiKey,priority,rateLimit
Account 1,google-gemini,sk-xxx...,0,0
Account 2,openai,sk-yyy...,1,60
```

**Pipe-separated:**
```
Account 1|google-gemini|sk-xxx...
Account 2|openai|sk-yyy...
```

**JSON Array:**
```json
[
  {"name": "Account 1", "provider": "google-gemini", "apiKey": "sk-xxx...", "priority": 0},
  {"name": "Account 2", "provider": "openai", "apiKey": "sk-yyy...", "priority": 1, "rateLimit": 60}
]
```

### API Endpoints

**Chat Completions (OpenAI-compatible):**
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer ogw-your-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-pro", "messages": [{"role": "user", "content": "Hello"}]}'
```

**List Models:**
```bash
curl http://localhost:3000/v1/models
```

**OAuth Connect:**
```
GET /api/auth/authorize?provider=google-gemini
```

## OAuth Setup

### Google Gemini

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Set redirect URI: `https://your-domain.com/api/auth/callback/google-gemini`
4. Set env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### Kiro

1. Register app at Kiro developer portal
2. Set redirect URI: `https://your-domain.com/api/auth/callback/kiro`
3. Set env vars: `KIRO_CLIENT_ID`, `KIRO_CLIENT_SECRET`

## Architecture

```
Client Request
    ↓
Gateway Key Validation
    ↓
Provider Detection (model → provider)
    ↓
Account Selection (round-robin, priority)
    ↓
Auth Resolution (API key or OAuth + refresh)
    ↓
Upstream Request
    ↓
Usage Recording
    ↓
Response (JSON or SSE stream)
```

## Environment Variables

```env
# Admin
ADMIN_USER=admin
ADMIN_PASS=gateway2026
JWT_SECRET=your-secret

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Kiro OAuth
KIRO_CLIENT_ID=
KIRO_CLIENT_SECRET=

# Redis (optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Deploy

### Vercel

```bash
vercel --prod
```

### Docker

```bash
docker build -t ogw-gateway .
docker run -p 3000:3000 --env-file .env.local ogw-gateway
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Auth**: jose JWT
- **Database**: Upstash Redis (or in-memory)
- **Styling**: Tailwind CSS 4

## Inspired By

[clovie-router](https://github.com/cloviel/clovie-router) — API key management pattern

## License

MIT
