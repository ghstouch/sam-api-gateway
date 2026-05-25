// ─── Provider Configuration ───
// Each provider can have multiple auth methods: API key, OAuth, or both

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
  models: string[];
  authMethods: ('apikey' | 'oauth')[];
  oauth?: OAuthConfig;
  headers: (credentials: Record<string, string>) => Record<string, string>;
}

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectPath: string;
  grantType: 'authorization_code' | 'client_credentials';
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  'google-gemini': {
    id: 'google-gemini',
    name: 'Google Gemini',
    icon: '🔮',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    authMethods: ['apikey', 'oauth'],
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/generative-language'],
      clientIdEnv: 'GOOGLE_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
      redirectPath: '/api/auth/callback/google-gemini',
      grantType: 'authorization_code',
    },
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.accessToken || creds.apiKey}`,
      'x-goog-api-key': creds.apiKey || '',
    }),
  },
  'google-cli': {
    id: 'google-cli',
    name: 'Google CLI (gcloud)',
    icon: '☁️',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    authMethods: ['oauth'],
    oauth: {
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/generative-language',
      ],
      clientIdEnv: 'GOOGLE_CLI_CLIENT_ID',
      clientSecretEnv: 'GOOGLE_CLI_CLIENT_SECRET',
      redirectPath: '/api/auth/callback/google-cli',
      grantType: 'authorization_code',
    },
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.accessToken}`,
      'x-goog-user-project': creds.projectId || '',
    }),
  },
  'kiro': {
    id: 'kiro',
    name: 'Kiro',
    icon: '⚡',
    baseUrl: 'https://api.kiro.dev/v1',
    models: ['kiro-pro', 'kiro-flash'],
    authMethods: ['apikey', 'oauth'],
    oauth: {
      authorizeUrl: 'https://auth.kiro.dev/oauth/authorize',
      tokenUrl: 'https://auth.kiro.dev/oauth/token',
      scopes: ['read', 'write'],
      clientIdEnv: 'KIRO_CLIENT_ID',
      clientSecretEnv: 'KIRO_CLIENT_SECRET',
      redirectPath: '/api/auth/callback/kiro',
      grantType: 'authorization_code',
    },
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.accessToken || creds.apiKey}`,
    }),
  },
  'xiaomi-mimo': {
    id: 'xiaomi-mimo',
    name: 'Xiaomi MiMo',
    icon: '🤖',
    baseUrl: 'https://opengateway.gitlawb.com/v1/xiaomi-mimo',
    models: ['mimo-v2-flash', 'mimo-v2-pro', 'mimo-v2.5', 'mimo-v2.5-pro'],
    authMethods: ['apikey'],
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.apiKey}`,
    }),
  },
  'openai': {
    id: 'openai',
    name: 'OpenAI',
    icon: '🧠',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    authMethods: ['apikey'],
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.apiKey}`,
    }),
  },
  'anthropic': {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🎭',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4', 'claude-opus-4', 'claude-haiku'],
    authMethods: ['apikey'],
    headers: (creds) => ({
      'Content-Type': 'application/json',
      'x-api-key': creds.apiKey,
      'anthropic-version': '2023-06-01',
    }),
  },
};
