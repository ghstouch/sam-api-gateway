'use client';
import { useState, useEffect } from 'react';

// ─── Types ───
interface Provider {
  id: string; name: string; icon: string; models: string[];
  authMethods: string[]; hasOAuth: boolean;
}

interface ProviderAccount {
  id: string; provider: string; name: string; authMethod: string;
  apiKey?: string; oauthTokenId?: string; requestCount: number;
  totalTokens: number; totalCost: number; lastUsed: string | null;
  enabled: boolean; priority: number; rateLimit: number;
}

interface GatewayKey {
  key: string; name: string; createdAt: string; lastUsed: string | null;
  requestCount: number; enabled: boolean; rateLimit: number;
}

interface OAuthToken {
  id: string; provider: string; accessToken: string; refreshToken: string;
  expiresAt: number; enabled: boolean; createdAt: string;
}

// ─── API Helper ───
async function api(path: string, opts?: RequestInit) {
  const token = localStorage.getItem('sam_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers: { ...headers, ...opts?.headers } });
  if (res.status === 401) { localStorage.removeItem('sam_token'); window.location.reload(); }
  return res.json();
}

// ─── Login Screen ───
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('sam_token', data.token);
        onLogin(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch { setError('Network error'); }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0f00 50%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden',
      padding: '24px',
    }}>
      {/* Subtle pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(212,168,67,0.06) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 80% 70%, rgba(16,185,129,0.04) 0%, transparent 60%)',
      }} />

      {/* Hero Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480, width: '100%' }}>
        <h1 style={{
          color: '#d4a843',
          fontSize: 'clamp(32px, 6vw, 48px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: 8,
          lineHeight: 1.1,
        }}>SAM Gateway</h1>
        <p style={{
          color: '#d4a843',
          fontSize: 'clamp(14px, 2.5vw, 18px)',
          fontWeight: 600,
          marginBottom: 40,
          opacity: 0.9,
        }}>Multi Provider Gateway</p>

        {/* Login Form */}
        <form onSubmit={handleLogin} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          width: '100%',
          maxWidth: 360,
          margin: '0 auto',
        }}>
          <input
            value={user}
            onChange={e => setUser(e.target.value)}
            placeholder="Username"
            style={{
              ...inputStyle,
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              borderRadius: 10,
            }}
          />
          <input
            value={pass}
            onChange={e => setPass(e.target.value)}
            type="password"
            placeholder="Password"
            style={{
              ...inputStyle,
              width: '100%',
              padding: '14px 16px',
              fontSize: 15,
              borderRadius: 10,
            }}
          />
          {error && <p style={{ color: '#c9a227', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            ...btnStyle,
            width: '100%',
            padding: '14px 24px',
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 10,
            marginTop: 4,
            background: 'linear-gradient(135deg, #d4a843, #c9a227)',
            color: '#0a0a0a',
          }}>{loading ? 'Logging in...' : 'Get Started'}</button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───
export default function Dashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'providers' | 'keys' | 'oauth' | 'batch'>('overview');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<ProviderAccount[]>([]);
  const [gatewayKeys, setGatewayKeys] = useState<GatewayKey[]>([]);
  const [oauthTokens, setOauthTokens] = useState<OAuthToken[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('sam_token');
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) loadData();
  }, [token]);

  // Listen for OAuth success from popup window → auto-refresh
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'oauth-connected') {
        loadData();
        showMsg(`${e.data.provider} OAuth connected!`);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [token]);

  async function loadData() {
    const [p, a, k, o] = await Promise.all([
      api('/api/admin/config'),
      api('/api/admin/providers'),
      api('/api/admin/keys'),
      api('/api/admin/oauth'),
    ]);
    setProviders(p.providers || []);
    setAccounts(a.accounts || []);
    setGatewayKeys(k.keys || []);
    setOauthTokens(o.tokens || []);
  }

  function showMsg(text: string) { setMsg(text); setTimeout(() => setMsg(''), 3000); }

  if (!token) return <LoginScreen onLogin={setToken} />;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'providers', label: 'Providers' },
    { id: 'keys', label: 'API Keys' },
    { id: 'oauth', label: 'OAuth' },
    { id: 'batch', label: 'Batch Import' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0f00 50%, #0a0a0a 100%)', color: '#eee', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header - Strive style */}
      <header style={{
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(212,168,67,0.15)',
        padding: '0 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <h1 style={{ fontSize: 22, margin: 0, fontWeight: 800, color: '#d4a843', letterSpacing: '-0.01em' }}>SAM Gateway</h1>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {msg && <span style={{ color: '#d4a843', fontSize: 13, fontWeight: 500 }}>{msg}</span>}
          <button onClick={() => { localStorage.removeItem('sam_token'); setToken(null); }} style={{
            ...btnStyle,
            fontSize: 13,
            padding: '8px 20px',
            fontWeight: 600,
            background: 'linear-gradient(135deg, #d4a843, #c9a227)',
            color: '#0a0a0a',
            borderRadius: 8,
          }}>Logout</button>
        </div>
      </header>

      {/* Tabs - Strive underline style */}
      <nav style={{
        display: 'flex',
        gap: 0,
        padding: '0 24px',
        background: 'rgba(0,0,0,0.2)',
        borderBottom: '1px solid rgba(212,168,67,0.1)',
        overflowX: 'auto',
      }}>
        {tabs.map(t => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#d4a843'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#888'; }}
              style={{
                ...btnStyle,
                padding: '16px 20px',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #d4a843' : '2px solid transparent',
                color: isActive ? '#d4a843' : '#888',
                borderRadius: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >{t.label}</button>
          );
        })}
      </nav>

      {/* Content */}
      <main style={{ padding: '24px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>
        {tab === 'overview' && <OverviewTab providers={providers} accounts={accounts} gatewayKeys={gatewayKeys} oauthTokens={oauthTokens} />}
        {tab === 'providers' && <ProvidersTab providers={providers} accounts={accounts} onReload={loadData} showMsg={showMsg} />}
        {tab === 'keys' && <KeysTab gatewayKeys={gatewayKeys} onReload={loadData} showMsg={showMsg} />}
        {tab === 'oauth' && <OAuthTab providers={providers} oauthTokens={oauthTokens} onReload={loadData} showMsg={showMsg} />}
        {tab === 'batch' && <BatchTab providers={providers} onReload={loadData} showMsg={showMsg} />}
      </main>
    </div>
  );
}

// ─── Overview Tab ───
function OverviewTab({ providers, accounts, gatewayKeys, oauthTokens }: {
  providers: Provider[]; accounts: ProviderAccount[]; gatewayKeys: GatewayKey[]; oauthTokens: OAuthToken[];
}) {
  const stats = [
    { label: 'Providers', value: providers.length, icon: '>' },
    { label: 'Provider Accounts', value: accounts.length, sub: `${accounts.filter(a => a.enabled).length} active`, icon: '*' },
    { label: 'Gateway Keys', value: gatewayKeys.length, sub: `${gatewayKeys.filter(k => k.enabled).length} active`, icon: '#' },
    { label: 'OAuth Tokens', value: oauthTokens.length, sub: `${oauthTokens.filter(t => t.enabled && t.expiresAt > Date.now()).length} valid`, icon: '@' },
  ];

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Dashboard Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {stats.map(s => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{s.value}</div>
            <div style={{ color: '#888', fontSize: 13 }}>{s.label}</div>
            {s.sub && <div style={{ color: '#d4a843', fontSize: 12, marginTop: 4 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>Provider Accounts</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead><tr><th>Provider</th><th>Name</th><th>Auth</th><th>Requests</th><th>Status</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td>{a.provider}</td>
                <td>{a.name}</td>
                <td>{a.authMethod}</td>
                <td>{a.requestCount}</td>
                <td><span style={{ color: a.enabled ? '#d4a843' : '#c9a227' }}>{a.enabled ? 'Active' : 'Disabled'}</span></td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>No accounts configured</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>Supported Providers</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {providers.map(p => (
          <div key={p.id} style={{ ...cardStyle, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{p.icon}</span>
              <strong>{p.name}</strong>
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              Models: {p.models.join(', ')}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Auth: {p.authMethods.join(', ')} {p.hasOAuth && '(oauth)'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Providers Tab ───
function ProvidersTab({ providers, accounts, onReload, showMsg }: {
  providers: Provider[]; accounts: ProviderAccount[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const [form, setForm] = useState({ provider: '', name: '', authMethod: 'apikey' as 'apikey' | 'oauth', apiKey: '', priority: '0', rateLimit: '0' });

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const data: any = { provider: form.provider, name: form.name, authMethod: form.authMethod, priority: parseInt(form.priority), rateLimit: parseInt(form.rateLimit) };
    if (form.authMethod === 'apikey') data.apiKey = form.apiKey;
    const res = await api('/api/admin/providers', { method: 'POST', body: JSON.stringify(data) });
    if (res.account) { showMsg('Account added!'); setForm({ ...form, name: '', apiKey: '' }); onReload(); }
    else showMsg('Error: ' + (res.error || 'Failed'));
  }

  async function deleteAccount(id: string) {
    await api('/api/admin/providers', { method: 'DELETE', body: JSON.stringify({ id }) });
    showMsg('Deleted'); onReload();
  }

  async function toggleAccount(id: string, updates: any) {
    await api('/api/admin/providers', { method: 'PATCH', body: JSON.stringify({ id, ...updates }) });
    showMsg('Updated'); onReload();
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Provider Accounts</h2>

      {/* Add Account Form */}
      <form onSubmit={addAccount} style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Add Account</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} style={inputStyle} required>
            <option value="">Select Provider</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
          </select>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Account name" style={inputStyle} required />
          <select value={form.authMethod} onChange={e => setForm({ ...form, authMethod: e.target.value as any })} style={inputStyle}>
            <option value="apikey">API Key</option>
            <option value="oauth">OAuth</option>
          </select>
          {form.authMethod === 'apikey' && (
            <input value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })} placeholder="API Key" style={inputStyle} required />
          )}
          <input value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} placeholder="Priority (0=highest)" type="number" style={inputStyle} />
          <input value={form.rateLimit} onChange={e => setForm({ ...form, rateLimit: e.target.value })} placeholder="Rate limit/min (0=unlimited)" type="number" style={inputStyle} />
        </div>
        <button type="submit" style={{ ...btnStyle, marginTop: 12 }}>Add Account</button>
      </form>

      {/* Accounts List */}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead><tr><th>Provider</th><th>Name</th><th>Auth</th><th>Priority</th><th>Requests</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id}>
                <td>{providers.find(p => p.id === a.provider)?.icon} {a.provider}</td>
                <td>{a.name}</td>
                <td>{a.authMethod}</td>
                <td>{a.priority}</td>
                <td>{a.requestCount}</td>
                <td><span style={{ color: a.enabled ? '#d4a843' : '#c9a227' }}>{a.enabled ? 'OK' : 'NO'}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleAccount(a.id, { enabled: !a.enabled })} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px' }}>{a.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => deleteAccount(a.id)} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px', background: 'rgba(201,162,39,0.2)' }}>Delete</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#666' }}>No accounts</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gateway Keys Tab ───
function KeysTab({ gatewayKeys, onReload, showMsg }: {
  gatewayKeys: GatewayKey[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const [keyName, setKeyName] = useState('');

  async function generateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    const res = await api('/api/admin/keys', { method: 'POST', body: JSON.stringify({ name: keyName }) });
    if (res.key) { showMsg('Key generated!'); setKeyName(''); onReload(); }
  }

  async function deleteKey(key: string) {
    await api('/api/admin/keys', { method: 'DELETE', body: JSON.stringify({ key }) });
    showMsg('Revoked'); onReload();
  }

  async function toggleKey(key: string) {
    await api('/api/admin/keys', { method: 'PATCH', body: JSON.stringify({ key }) });
    showMsg('Toggled'); onReload();
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Gateway API Keys</h2>

      <form onSubmit={generateKey} style={{ ...cardStyle, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Key name" style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" style={btnStyle}>Generate Key</button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead><tr><th>Name</th><th>Key</th><th>Requests</th><th>Last Used</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {gatewayKeys.map(k => (
              <tr key={k.key}>
                <td>{k.name}</td>
                <td>
                  <code 
                    style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
                    onClick={() => { navigator.clipboard.writeText(k.key); showMsg('Copied!'); }}
                    title="Click to copy"
                  >{k.key}</code>
                </td>
                <td>{k.requestCount}</td>
                <td>{k.lastUsed ? new Date(k.lastUsed).toLocaleString() : 'Never'}</td>
                <td><span style={{ color: k.enabled ? '#d4a843' : '#c9a227' }}>{k.enabled ? 'OK' : 'NO'}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { navigator.clipboard.writeText(k.key); showMsg('Copied!'); }} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px' }}>Copy</button>
                  <button onClick={() => toggleKey(k.key)} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px' }}>{k.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => deleteKey(k.key)} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px', background: 'rgba(201,162,39,0.2)' }}>Revoke</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── OAuth Tab ───
function OAuthTab({ providers, oauthTokens, onReload, showMsg }: {
  providers: Provider[]; oauthTokens: OAuthToken[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const oauthProviders = providers.filter(p => p.hasOAuth);

  async function deleteToken(id: string) {
    await api('/api/admin/oauth', { method: 'DELETE', body: JSON.stringify({ id }) });
    showMsg('Token deleted'); onReload();
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>OAuth Tokens</h2>

      {/* Connect OAuth */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Connect OAuth Provider</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {oauthProviders.map(p => (
            <a key={p.id} href={`/api/auth/authorize?provider=${p.id}`} target="_blank" rel="noopener noreferrer" style={{
              ...btnStyle, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{p.icon}</span> Connect {p.name}
            </a>
          ))}
          {oauthProviders.length === 0 && <p style={{ color: '#666' }}>No OAuth providers configured</p>}
        </div>
      </div>

      {/* Tokens List */}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead><tr><th>Provider</th><th>Token ID</th><th>Access Token</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {oauthTokens.map(t => {
              const expired = t.expiresAt < Date.now();
              return (
                <tr key={t.id}>
                  <td>{t.provider}</td>
                  <td><code style={{ fontSize: 11 }}>{t.id.slice(0, 8)}...</code></td>
                  <td><code style={{ fontSize: 11 }}>{t.accessToken}</code></td>
                  <td style={{ color: expired ? '#c9a227' : '#d4a843' }}>{new Date(t.expiresAt).toLocaleString()}</td>
                  <td><span style={{ color: expired ? '#c9a227' : t.enabled ? '#d4a843' : '#888' }}>{expired ? 'Expired' : t.enabled ? 'Valid' : 'Disabled'}</span></td>
                  <td>
                    <button onClick={() => deleteToken(t.id)} style={{ ...btnStyle, fontSize: 11, padding: '4px 8px', background: 'rgba(201,162,39,0.2)' }}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {oauthTokens.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#666' }}>No OAuth tokens</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Batch Import Tab ───
function BatchTab({ providers, onReload, showMsg }: {
  providers: Provider[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const [batchText, setBatchText] = useState('');
  const [batchFormat, setBatchFormat] = useState<'csv' | 'lines' | 'json'>('csv');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [batchType, setBatchType] = useState<'provider' | 'gateway'>('provider');

  async function importBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchText.trim()) return;

    if (batchType === 'provider') {
      const res = await api('/api/admin/providers/batch', {
        method: 'POST',
        body: JSON.stringify({
          keys: batchText,
          format: batchFormat === 'json' ? undefined : batchFormat,
          ...(batchFormat === 'json' ? { keys: JSON.parse(batchText) } : {}),
        }),
      });
      setBatchResult(res);
      if (res.success > 0) { showMsg(`Imported ${res.success} keys!`); onReload(); }
    } else {
      // Gateway keys batch
      let batch: any[];
      if (batchFormat === 'json') {
        batch = JSON.parse(batchText);
      } else if (batchFormat === 'csv') {
        batch = batchText.trim().split('\n').filter(l => l.trim()).map(line => {
          const parts = line.split(',').map(p => p.trim());
          return { name: parts[0], rateLimit: parts[1] ? parseInt(parts[1]) : 0 };
        });
      } else {
        batch = batchText.trim().split('\n').filter(l => l.trim()).map(line => {
          const parts = line.split('|').map(p => p.trim());
          return { name: parts[0], rateLimit: parts[1] ? parseInt(parts[1]) : 0 };
        });
      }
      const res = await api('/api/admin/keys', { method: 'POST', body: JSON.stringify({ batch }) });
      setBatchResult(res);
      if (res.success > 0) { showMsg(`Imported ${res.success} keys!`); onReload(); }
    }
  }

  const placeholders: Record<string, Record<string, string>> = {
    provider: {
      csv: `name,provider,apiKey,priority,rateLimit
Account 1,google-gemini,sk-xxx...,0,0
Account 2,openai,sk-yyy...,1,60
Account 3,xiaomi-mimo,key-zzz...,2,0`,
      lines: `Account 1|google-gemini|sk-xxx...
Account 2|openai|sk-yyy...
Account 3|xiaomi-mimo|key-zzz...`,
      json: `[
  {"name": "Account 1", "provider": "google-gemini", "apiKey": "sk-xxx...", "priority": 0},
  {"name": "Account 2", "provider": "openai", "apiKey": "sk-yyy...", "priority": 1, "rateLimit": 60}
]`,
    },
    gateway: {
      csv: `name,rateLimit
Client A,0
Client B,100
Client C,60`,
      lines: `Client A|0
Client B|100
Client C|60`,
      json: `[
  {"name": "Client A"},
  {"name": "Client B", "rateLimit": 100},
  {"name": "Client C", "rateLimit": 60}
]`,
    },
  };

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Batch Import</h2>

      <form onSubmit={importBatch} style={cardStyle}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={batchType} onChange={e => { setBatchType(e.target.value as any); setBatchResult(null); }} style={inputStyle}>
            <option value="provider">Provider API Keys</option>
            <option value="gateway">Gateway Keys</option>
          </select>
          <select value={batchFormat} onChange={e => setBatchFormat(e.target.value as any)} style={inputStyle}>
            <option value="csv">CSV (name,provider,apiKey,...)</option>
            <option value="lines">Pipe-separated (name|provider|apiKey)</option>
            <option value="json">JSON Array</option>
          </select>
        </div>

        <textarea
          value={batchText}
          onChange={e => setBatchText(e.target.value)}
          placeholder={placeholders[batchType][batchFormat]}
          style={{ ...inputStyle, width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button type="submit" style={btnStyle}>Import</button>
          <button type="button" onClick={() => setBatchText('')} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)' }}>Clear</button>
        </div>
      </form>

      {batchResult && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Import Result</h3>
          <div style={{ display: 'flex', gap: 24 }}>
            <span style={{ color: '#d4a843' }}>OK Success: {batchResult.success}</span>
            {batchResult.failed > 0 && <span style={{ color: '#c9a227' }}>NO Failed: {batchResult.failed}</span>}
          </div>
          {batchResult.errors?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: '#c9a227', marginBottom: 4 }}>Errors:</div>
              {batchResult.errors.map((e: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#c9a227', marginLeft: 8 }}>• {e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Available Providers */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <h3 style={{ fontSize: 14, marginBottom: 8 }}>Available Providers</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {providers.map(p => (
            <span key={p.id} style={{ background: 'rgba(212,168,67,0.15)', padding: '4px 10px', borderRadius: 6, fontSize: 12, border: '1px solid rgba(212,168,67,0.2)' }}>
              {p.icon} {p.id}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Styles ───
const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(212,168,67,0.3)',
  borderRadius: 8,
  padding: '8px 12px',
  color: '#eee',
  fontSize: 14,
  outline: 'none',
};

const btnStyle: React.CSSProperties = {
  background: 'rgba(212,168,67,0.1)',
  border: '1px solid rgba(212,168,67,0.3)',
  borderRadius: 8,
  padding: '8px 16px',
  color: '#d4a843',
  fontSize: 13,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(212,168,67,0.2)',
  borderRadius: 12,
  padding: 20,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};
