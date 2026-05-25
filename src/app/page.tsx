'use client';
import { useState, useEffect } from 'react';

// ─── Types ───
interface Provider {
  id: string; name: string; icon: string; models: string[];
  authMethods: string[]; hasOAuth: boolean; baseUrl?: string;
}

interface ProviderAccount {
  id: string; provider: string; name: string; authMethod: string;
  apiKey?: string; baseUrl?: string; oauthTokenId?: string; requestCount: number;
  totalTokens: number; totalCost: number; lastUsed: string | null;
  enabled: boolean; priority: number; rateLimit: number;
}

interface GatewayKey {
  key: string; name: string; createdAt: string; lastUsed: string | null;
  requestCount: number; totalTokens: number; enabled: boolean; rateLimit: number;
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
              className="tab-btn"
              key={t.id}
              onClick={() => setTab(t.id)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#d4a843'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#888'; }}
              style={{
                padding: '16px 20px',
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                background: 'none',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                borderBottom: isActive ? '2px solid #d4a843' : '2px solid transparent',
                color: isActive ? '#d4a843' : '#888',
                cursor: 'pointer',
                borderRadius: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
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

// ─── Shared Helpers ───
function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

// ─── Overview Tab (clovie-router style) ───
function OverviewTab({ providers, accounts, gatewayKeys, oauthTokens }: {
  providers: Provider[]; accounts: ProviderAccount[]; gatewayKeys: GatewayKey[]; oauthTokens: OAuthToken[];
}) {
  const [view, setView] = useState<'overview' | 'details'>('overview');
  const [range, setRange] = useState<string>('24h');
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => { loadUsage(); }, [range]);

  async function loadUsage() {
    try {
      const token = localStorage.getItem('sam_token');
      const res = await fetch(`/api/admin/usage?range=${range}`, { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      if (data.stats) setUsage(data);
    } catch {}
  }

  const totalRequests = usage?.stats?.totalRequests || 0;
  const totalInput = usage?.stats?.totalInputTokens || 0;
  const totalOutput = usage?.stats?.totalOutputTokens || 0;
  const totalCost = usage?.stats?.totalCost || 0;
  const hourlyData: { hour: string; count: number }[] = usage?.stats?.hourlyRequests || [];
  const byModel: Record<string, { requests: number; tokens: number }> = usage?.stats?.byModel || {};

  function fmt(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  const rangeBtns = ['Today', '24h', '7D', '30D', '60D'];
  const viewBtns = ['Overview', 'Details'];

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(212,168,67,0.08)',
    borderRadius: 12,
    padding: 20,
  };

  const sBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(212,168,67,0.1)',
    borderRadius: 6,
    padding: '6px 12px',
    color: '#888',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const sBtnA: React.CSSProperties = { ...sBtn, background: 'rgba(212,168,67,0.15)', color: '#d4a843', borderColor: 'rgba(212,168,67,0.3)' };

  const maxH = hourlyData.length > 0 ? Math.max(...hourlyData.map(h => h.count), 1) : 1;
  const chartH = 100;

  return (
    <div>
      {/* View & Range selectors */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {viewBtns.map(v => (
            <button key={v} onClick={() => setView(v.toLowerCase() as any)}
              className="tab-btn"
              style={view === v.toLowerCase() ? sBtnA : sBtn}
              onMouseEnter={e => { if (view !== v.toLowerCase()) e.currentTarget.style.color = '#d4a843'; }}
              onMouseLeave={e => { if (view !== v.toLowerCase()) e.currentTarget.style.color = '#888'; }}
            >{v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rangeBtns.map(r => (
            <button key={r} onClick={() => setRange(r.toLowerCase())}
              className="tab-btn"
              style={range === r.toLowerCase() ? sBtnA : sBtn}
              onMouseEnter={e => { if (range !== r.toLowerCase()) e.currentTarget.style.color = '#d4a843'; }}
              onMouseLeave={e => { if (range !== r.toLowerCase()) e.currentTarget.style.color = '#888'; }}
            >{r}</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>TOTAL REQUESTS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#fff' }}>{fmt(totalRequests)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>TOTAL INPUT TOKENS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#ef4444' }}>{fmt(totalInput)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>OUTPUT TOKENS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#4ade80' }}>{fmt(totalOutput)}</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>EST. COST</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#d4a843' }}>{totalCost > 0 ? `~$${totalCost.toFixed(2)}` : '~$0.00'}</div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>Estimated, not actual billing</div>
        </div>
      </div>

      {/* Hourly Requests Chart */}
      {hourlyData.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>REQUESTS PER HOUR</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: chartH, overflow: 'hidden' }}>
            {hourlyData.slice(-48).map((h, i) => {
              const barH = Math.max(2, (h.count / maxH) * chartH);
              return (
                <div key={i} title={`${h.hour}: ${h.count} requests`} style={{
                  flex: 1,
                  height: barH,
                  background: 'linear-gradient(to top, rgba(212,168,67,0.6), rgba(212,168,67,0.2))',
                  borderRadius: '3px 3px 0 0',
                  minWidth: 4,
                  transition: 'height 0.3s',
                }} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 10, color: '#555' }}>{hourlyData.length > 0 ? hourlyData[Math.max(0, hourlyData.length - 48)].hour.slice(11) : ''}</span>
            <span style={{ fontSize: 10, color: '#555' }}>{hourlyData.length > 0 ? hourlyData[hourlyData.length - 1].hour.slice(11) : ''}</span>
          </div>
        </div>
      )}

      {/* Details view */}
      {view === 'details' && (
        <>
          {/* By Model breakdown */}
          {Object.keys(byModel).length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>By Model</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead><tr><th>Model</th><th>Requests</th><th>Tokens</th><th>Share</th></tr></thead>
                  <tbody>
                    {Object.entries(byModel).sort(([, a], [, b]) => b.requests - a.requests).map(([model, data]) => (
                      <tr key={model}>
                        <td>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4ade80', marginRight: 8, verticalAlign: 'middle' }} />
                          {model}
                        </td>
                        <td>{data.requests}</td>
                        <td>{fmt(data.tokens)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                              <div style={{ width: `${totalRequests > 0 ? (data.requests / totalRequests * 100) : 0}%`, height: '100%', background: '#d4a843', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#888' }}>{totalRequests > 0 ? (data.requests / totalRequests * 100).toFixed(0) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By Provider breakdown */}
          {usage?.stats?.byProvider && Object.keys(usage.stats.byProvider).length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>By Provider</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead><tr><th>Provider</th><th>Requests</th><th>Tokens</th><th>Share</th></tr></thead>
                  <tbody>
                    {Object.entries(usage.stats.byProvider).sort(([, a]: any, [, b]: any) => b.requests - a.requests).map(([prov, data]: [string, any]) => (
                      <tr key={prov}>
                        <td>{prov}</td>
                        <td>{data.requests}</td>
                        <td>{fmt(data.tokens)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 60, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                              <div style={{ width: `${totalRequests > 0 ? (data.requests / totalRequests * 100) : 0}%`, height: '100%', background: '#d4a843', borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#888' }}>{totalRequests > 0 ? (data.requests / totalRequests * 100).toFixed(0) : 0}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Requests — clovie style */}
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Recent Requests</h3>
          {usage?.recentLogs && usage.recentLogs.length > 0 ? (
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {usage.recentLogs.slice(0, 50).map((r: any, i: number) => (
                  <div key={r.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: i < 49 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    gap: 16,
                    fontSize: 13,
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Model + status dot */}
                    <div style={{ flex: '1 1 200px', minWidth: 150, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.status === 'error' ? '#ef4444' : '#4ade80', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, color: '#eee' }}>{r.model || 'unknown'}</span>
                    </div>
                    {/* In / Out — clovie style */}
                    <div style={{ flex: '0 0 160px', display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 12 }}>
                      <span style={{ color: '#ef4444' }}>&#8593;{fmt(r.promptTokens)}</span>
                      <span style={{ color: '#4ade80' }}>&#8595;{fmt(r.completionTokens)}</span>
                    </div>
                    {/* Latency */}
                    <div style={{ flex: '0 0 70px', color: '#666', fontSize: 12, textAlign: 'right' }}>
                      {r.latencyMs ? (r.latencyMs >= 1000 ? (r.latencyMs / 1000).toFixed(1) + 's' : r.latencyMs + 'ms') : '—'}
                    </div>
                    {/* Time ago */}
                    <div style={{ flex: '0 0 80px', color: '#555', fontSize: 12, textAlign: 'right' }}>
                      {timeAgo(r.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>No requests recorded yet</div>
          )}
        </>
      )}

      {/* Provider summary (overview mode) */}
      {view === 'overview' && (
        <>
          {/* Quick recent requests (last 5) */}
          {usage?.recentLogs && usage.recentLogs.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Recent Requests</h3>
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                {usage.recentLogs.slice(0, 5).map((r: any, i: number) => (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', padding: '10px 16px',
                    borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none', gap: 16, fontSize: 13,
                  }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: r.status === 'error' ? '#ef4444' : '#4ade80' }} />
                      <span style={{ fontWeight: 600, color: '#eee' }}>{r.model || 'unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 12 }}>
                      <span style={{ color: '#ef4444' }}>&#8593;{fmt(r.promptTokens)}</span>
                      <span style={{ color: '#4ade80' }}>&#8595;{fmt(r.completionTokens)}</span>
                    </div>
                    <div style={{ color: '#555', fontSize: 12 }}>{timeAgo(r.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provider cards */}
          <h3 style={{ fontSize: 14, marginBottom: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Provider Accounts</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {providers.map(p => (
              <div key={p.id} style={{ ...card, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{p.icon}</span>
                  <strong style={{ fontSize: 14 }}>{p.name}</strong>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>{accounts.filter(a => a.provider === p.id).length} accounts</span>
                </div>
                <div style={{ fontSize: 11, color: '#666' }}>Models: {p.models.slice(0, 3).join(', ')}{p.models.length > 3 ? '...' : ''}</div>
              </div>
            ))}
            {providers.length === 0 && <div style={{ color: '#555' }}>No providers configured</div>}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Providers Tab ───
function ProvidersTab({ providers, accounts, onReload, showMsg }: {
  providers: Provider[]; accounts: ProviderAccount[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const [form, setForm] = useState({ provider: '', name: '', authMethod: 'apikey' as 'apikey' | 'oauth', apiKey: '', baseUrl: '', priority: '0', rateLimit: '0' });

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    const data: any = { provider: form.provider, name: form.name, authMethod: form.authMethod, priority: parseInt(form.priority) || 0, rateLimit: parseInt(form.rateLimit) || 0 };
    if (form.authMethod === 'apikey') data.apiKey = form.apiKey;
    if (form.baseUrl.trim()) data.baseUrl = form.baseUrl.trim();
    const res = await api('/api/admin/providers', { method: 'POST', body: JSON.stringify(data) });
    if (res.account) { showMsg('Account added!'); setForm({ ...form, name: '', apiKey: '', baseUrl: '' }); onReload(); }
    else showMsg('Error: ' + (res.error || 'Failed'));
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account?')) return;
    await api('/api/admin/providers', { method: 'DELETE', body: JSON.stringify({ id }) });
    showMsg('Deleted'); onReload();
  }

  async function toggleAccount(id: string, updates: any) {
    await api('/api/admin/providers', { method: 'PATCH', body: JSON.stringify({ id, ...updates }) });
    showMsg('Updated'); onReload();
  }

  function maskKey(key: string) {
    if (!key) return '-';
    if (key.length <= 10) return key;
    return key.slice(0, 6) + '...' + key.slice(-4);
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
          <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })} placeholder="Base URL (optional, e.g. https://api.openai.com/v1)" style={inputStyle} />
          <input value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} placeholder="Priority (0=highest)" type="number" style={inputStyle} />
          <input value={form.rateLimit} onChange={e => setForm({ ...form, rateLimit: e.target.value })} placeholder="Rate limit/min (0=unlimited)" type="number" style={inputStyle} />
        </div>
        <button type="submit" style={{ ...btnStyle, marginTop: 12 }}>Add Account</button>
      </form>

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          No provider accounts. Add one above to start routing requests.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th>Provider</th><th>Name</th><th>Auth</th><th>Key</th><th>Base URL</th><th>Priority</th><th>Requests</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id}>
                  <td>{providers.find(p => p.id === a.provider)?.icon} {a.provider}</td>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td><span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{a.authMethod}</span></td>
                  <td><code style={{ fontSize: 11 }}>{a.apiKey ? maskKey(a.apiKey) : '-'}</code></td>
                  <td><code style={{ fontSize: 10, color: '#888' }}>{a.baseUrl || providers.find(p => p.id === a.provider)?.baseUrl || '-'}</code></td>
                  <td>{a.priority}</td>
                  <td>{a.requestCount.toLocaleString()}</td>
                  <td><span style={{ color: a.enabled ? '#10b981' : '#c9a227', fontSize: 12 }}>{a.enabled ? 'Active' : 'Disabled'}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => toggleAccount(a.id, { enabled: !a.enabled })} style={{ ...btnStyle, fontSize: 11, padding: '4px 10px' }}>{a.enabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteAccount(a.id)} style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Gateway Keys Tab ───
function KeysTab({ gatewayKeys, onReload, showMsg }: {
  gatewayKeys: GatewayKey[]; onReload: () => void; showMsg: (m: string) => void;
}) {
  const [keyName, setKeyName] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function generateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    const res = await api('/api/admin/keys', { method: 'POST', body: JSON.stringify({ name: keyName }) });
    if (res.key) { showMsg('Key generated!'); setKeyName(''); onReload(); }
  }

  async function deleteKey(key: string) {
    if (!confirm('Revoke this key? This cannot be undone.')) return;
    await api('/api/admin/keys', { method: 'DELETE', body: JSON.stringify({ key }) });
    showMsg('Revoked'); onReload();
  }

  async function toggleKey(key: string) {
    await api('/api/admin/keys', { method: 'PATCH', body: JSON.stringify({ key }) });
    showMsg('Toggled'); onReload();
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    showMsg('Copied!');
    setTimeout(() => setCopiedKey(null), 2000);
  }

  function maskKey(key: string) {
    if (key.length <= 12) return key;
    return key.slice(0, 8) + '...' + key.slice(-6);
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Gateway API Keys</h2>

      {/* Generate Key Form */}
      <form onSubmit={generateKey} style={{ ...cardStyle, marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="Key name (e.g. My App)" style={{ ...inputStyle, flex: 1 }} />
        <button type="submit" style={btnStyle}>Generate Key</button>
      </form>

      {/* Keys List */}
      {gatewayKeys.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', color: '#666', padding: 40 }}>
          No API keys yet. Generate one above.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead><tr><th>Name</th><th>Key</th><th>Requests</th><th>Tokens</th><th>Last Used</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {gatewayKeys.map(k => (
                <tr key={k.key}>
                  <td style={{ fontWeight: 500 }}>{k.name}</td>
                  <td>
                    <code
                      style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
                      onClick={() => copyKey(k.key)}
                      title="Click to copy full key"
                    >{maskKey(k.key)}</code>
                  </td>
                  <td>{k.requestCount.toLocaleString()}</td>
                  <td>{k.totalTokens.toLocaleString()}</td>
                  <td>{k.lastUsed ? timeAgo(k.lastUsed) : 'Never'}</td>
                  <td><span style={{ color: k.enabled ? '#10b981' : '#c9a227', fontSize: 12 }}>{k.enabled ? 'Active' : 'Disabled'}</span></td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => copyKey(k.key)} style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', background: copiedKey === k.key ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)' }}>
                      {copiedKey === k.key ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={() => toggleKey(k.key)} style={{ ...btnStyle, fontSize: 11, padding: '4px 10px' }}>{k.enabled ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => deleteKey(k.key)} style={{ ...btnStyle, fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Usage Summary */}
      {gatewayKeys.length > 0 && (
        <div style={{ ...cardStyle, marginTop: 24, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span style={{ color: '#888', fontSize: 12 }}>Total Keys</span><br /><span style={{ fontSize: 20, color: '#d4a843' }}>{gatewayKeys.length}</span></div>
          <div><span style={{ color: '#888', fontSize: 12 }}>Active</span><br /><span style={{ fontSize: 20, color: '#10b981' }}>{gatewayKeys.filter(k => k.enabled).length}</span></div>
          <div><span style={{ color: '#888', fontSize: 12 }}>Total Requests</span><br /><span style={{ fontSize: 20, color: '#d4a843' }}>{gatewayKeys.reduce((s, k) => s + k.requestCount, 0).toLocaleString()}</span></div>
          <div><span style={{ color: '#888', fontSize: 12 }}>Total Tokens</span><br /><span style={{ fontSize: 20, color: '#d4a843' }}>{gatewayKeys.reduce((s, k) => s + k.totalTokens, 0).toLocaleString()}</span></div>
        </div>
      )}
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
