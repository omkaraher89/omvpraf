// Cloudflare Worker entry for the TradingView Pro terminal.
//
// The original app ships an Express server with a persistent in-memory market feed.
// Freebuff Sites runs Workers, so this worker re-implements the same HTTP surface:
//  - market/LSE data is served from the LSE REST API (the browser's WebSocket attempt
//    fails and its existing HTTP polling fallback drives live prices)
//  - accounts, sessions and workspace persistence (preferences, layouts, drawings,
//    templates, alerts, positions) are stored in D1 instead of Firebase/Firestore
// and then falls through to the built static assets.
//
// Auth is fully self-hosted: email + password, PBKDF2 hashing and HttpOnly session
// cookies. The only external credential is LSE_API_KEY.

import {
  clearedSessionCookie,
  createSession,
  createUser,
  destroySession,
  ensureAuthSchema,
  findUserByEmail,
  getSessionUser,
  hashPassword,
  isSameOriginRequest,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  sessionCookie,
  verifyPassword,
} from './auth.ts';
import type { D1DatabaseLike, SessionUser } from './auth.ts';
import { LseClient } from '../src/server/lseClient.ts';
import { filterCandlesBySession } from '../src/utils/marketEngine.ts';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  DB?: D1DatabaseLike & { exec?: (sql: string) => Promise<unknown> };
  LSE_API_KEY?: string;
}

let lse: LseClient | null = null;
let hydratePromise: Promise<void> | null = null;
let schemaPromise: Promise<void> | null = null;

function getLse(env: Env): LseClient {
  if (!lse) {
    lse = new LseClient(env.LSE_API_KEY || '');
  }
  return lse;
}

function ensureHydrated(client: LseClient): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = client.hydrateWatchlistFromLse().catch(() => undefined);
  }
  return hydratePromise;
}

function ensureSchema(db: Env['DB']): Promise<void> {
  if (!db) return Promise.resolve();
  if (!schemaPromise) {
    schemaPromise = ensureAuthSchema(db).catch(() => {
      // Allow a later request to retry the migration
      schemaPromise = null;
    });
  }
  return schemaPromise;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const errorJson = (message: string, status = 502): Response => json({ error: message }, status);

async function clientIpPayload(request: Request): Promise<Record<string, unknown>> {
  const forwarded = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
  const rawIp = forwarded.split(',')[0]?.trim() || '127.0.0.1';
  const normalizedIp =
    rawIp
      .replace(/^::ffff:/i, '')
      .replace(/[^0-9a-fA-F.:]/g, '')
      .slice(0, 64)
      .trim() || '127.0.0.1';

  let maskedIp = normalizedIp;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedIp)) {
    const parts = normalizedIp.split('.');
    maskedIp = `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  } else if (normalizedIp.includes(':')) {
    const segs = normalizedIp.split(':');
    maskedIp = `${segs.slice(0, 3).join(':')}:xxxx`;
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizedIp));
  const ipHash = `ip_${Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)}`;

  const ua = request.headers.get('user-agent') || '';
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua)
    ? 'macOS'
    : /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad|iOS/i.test(ua)
    ? 'iOS'
    : /Linux/i.test(ua)
    ? 'Linux'
    : 'Browser';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
    ? 'Chrome'
    : /Firefox\//i.test(ua)
    ? 'Firefox'
    : /Safari\//i.test(ua)
    ? 'Safari'
    : 'Web';

  return {
    ipDisplay: normalizedIp,
    maskedIp,
    ipHash,
    deviceLabel: `${browser} on ${os}`,
    detectedAt: Date.now(),
  };
}

const PRIVATE_JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'private, no-store',
};

const jsonPrivate = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...PRIVATE_JSON_HEADERS, ...extra },
  });

function publicUser(user: SessionUser) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

const MIN_PASSWORD_LENGTH = 8;

async function handleSignup(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('Method not allowed.', 405);
  if (!isSameOriginRequest(request)) return errorJson('Cross-origin requests are not allowed.', 403);
  const db = env.DB;
  if (!db) return errorJson('Database is not configured for this deployment.', 503);

  let body: { email?: unknown; password?: unknown; name?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown; name?: unknown };
  } catch {
    return errorJson('Invalid JSON body.', 400);
  }

  const email = normalizeEmail(body.email);
  if (!isValidEmail(email)) return errorJson('Enter a valid email address.', 400);
  const password = String(body.password ?? '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return errorJson(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
  }
  if (password.length > 200) return errorJson('Password is too long.', 400);
  const name = normalizeName(body.name);

  await ensureSchema(db);
  if (await findUserByEmail(db, email)) {
    return errorJson('An account with this email already exists.', 409);
  }

  let user: SessionUser;
  try {
    user = await createUser(db, email, name, await hashPassword(password));
  } catch {
    // Unique index race with a concurrent signup
    return errorJson('An account with this email already exists.', 409);
  }

  const token = await createSession(db, user.id);
  return jsonPrivate({ user: publicUser(user) }, 201, {
    'Set-Cookie': sessionCookie(token, new URL(request.url)),
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('Method not allowed.', 405);
  if (!isSameOriginRequest(request)) return errorJson('Cross-origin requests are not allowed.', 403);
  const db = env.DB;
  if (!db) return errorJson('Database is not configured for this deployment.', 503);

  let body: { email?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return errorJson('Invalid JSON body.', 400);
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password ?? '');
  if (!email || !password) return errorJson('Email and password are required.', 400);

  await ensureSchema(db);
  const record = await findUserByEmail(db, email);
  const valid = record ? await verifyPassword(password, record.password_hash) : false;
  if (!record || !valid) {
    return errorJson('Invalid email or password.', 401);
  }

  const token = await createSession(db, record.id);
  return jsonPrivate(
    {
      user: publicUser({
        id: record.id,
        email: record.email,
        name: record.name ?? null,
        createdAt: record.created_at ?? null,
      }),
    },
    200,
    { 'Set-Cookie': sessionCookie(token, new URL(request.url)) }
  );
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('Method not allowed.', 405);
  if (!isSameOriginRequest(request)) return errorJson('Cross-origin requests are not allowed.', 403);
  if (env.DB) {
    await ensureSchema(env.DB);
    await destroySession(env.DB, request);
  }
  return jsonPrivate({ ok: true }, 200, {
    'Set-Cookie': clearedSessionCookie(new URL(request.url)),
  });
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return errorJson('Method not allowed.', 405);
  const db = env.DB;
  if (!db) return jsonPrivate({ user: null });
  await ensureSchema(db);
  const user = await getSessionUser(db, request);
  return jsonPrivate({ user: user ? publicUser(user) : null });
}

async function handleWorkspace(request: Request, env: Env): Promise<Response> {
  const db = env.DB;
  if (!db) return errorJson('Workspace database is not configured.', 503);

  await ensureSchema(db);

  // Authorization is always decided on the server from the session, never from the request body.
  const user = await getSessionUser(db, request);
  if (!user) return errorJson('Sign in required.', 401);
  const owner = user.id;

  if (request.method === 'GET') {
    const row = await db
      .prepare('SELECT snapshot_json, updated_at FROM workspaces WHERE client_id = ?')
      .bind(owner)
      .first<{ snapshot_json: string; updated_at: number }>();
    const headers = { 'Cache-Control': 'private, no-store' };
    if (!row) {
      return new Response(JSON.stringify({ snapshot: null, updatedAt: null }), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
      });
    }
    let snapshot: unknown = null;
    try {
      snapshot = JSON.parse(row.snapshot_json);
    } catch {
      snapshot = null;
    }
    return new Response(JSON.stringify({ snapshot, updatedAt: row.updated_at }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    });
  }

  if (request.method === 'PUT' || request.method === 'POST') {
    if (!isSameOriginRequest(request)) {
      return errorJson('Cross-origin writes are not allowed.', 403);
    }
    let body: { snapshot?: unknown };
    try {
      body = (await request.json()) as { snapshot?: unknown };
    } catch {
      return errorJson('Invalid JSON body.', 400);
    }
    if (!body.snapshot || typeof body.snapshot !== 'object') {
      return errorJson('A workspace snapshot object is required.', 400);
    }
    const payload = JSON.stringify(body.snapshot);
    if (payload.length > 4_000_000) {
      return errorJson('Workspace snapshot is too large.', 413);
    }
    const updatedAt = Date.now();
    await db
      .prepare(
        `INSERT INTO workspaces (client_id, snapshot_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(client_id) DO UPDATE SET snapshot_json = excluded.snapshot_json, updated_at = excluded.updated_at`
      )
      .bind(owner, payload, updatedAt)
      .run();
    return new Response(JSON.stringify({ ok: true, updatedAt }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' },
    });
  }

  return errorJson('Method not allowed.', 405);
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response | null> {
  const path = url.pathname;
  if (!path.startsWith('/api/')) return null;
  const method = request.method.toUpperCase();

  if (path === '/api/health') {
    // ws:false tells the browser to use the HTTP polling feed instead of opening a socket
    return json({ ok: true, time: Date.now(), ws: false });
  }

  if (path === '/api/auth/signup') return handleSignup(request, env);
  if (path === '/api/auth/login') return handleLogin(request, env);
  if (path === '/api/auth/logout') return handleLogout(request, env);
  if (path === '/api/auth/session' || path === '/api/auth/me') return handleSession(request, env);

  if (path === '/api/workspace') {
    return handleWorkspace(request, env);
  }

  if (path === '/api/auth/client-ip') {
    return json(await clientIpPayload(request));
  }

  const client = getLse(env);
  const apiKeyConfigured = client.hasKey();
  if (!apiKeyConfigured) {
    return errorJson('LSE_API_KEY is not configured for this deployment.', 503);
  }

  if (path === '/api/market/snapshot') {
    await ensureHydrated(client);
    const symbols = client.getAllSymbols();
    return json({
      symbols,
      serverTime: Date.now(),
      liveStreamEnabled: true,
      wsStatus: client.getWsStatus(),
      seq: 0,
      apiConfigured: true,
    });
  }

  if (path === '/api/market/live') {
    // Never block the live feed on first-run watchlist hydration: serve the cached symbols now.
    void ensureHydrated(client);
    const symbolsParam = (url.searchParams.get('symbols') || '').trim();
    const priority = symbolsParam
      ? symbolsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : ['NASDAQ100', 'BTCUSDT'];
    let polled: Awaited<ReturnType<LseClient['pollLiveQuotesFallback']>> = [];
    try {
      polled = await client.pollLiveQuotesFallback(priority);
    } catch {
      // Serve the last known snapshot even if the upstream poll fails
    }
    const baseSeq = Date.now();
    return json({
      symbols: client.getAllSymbols(),
      ticks: polled.map((item, idx) => ({
        seq: baseSeq + idx,
        tick: item.sym,
        rawTick: item.rawTick,
      })),
      seq: baseSeq + polled.length,
      liveStreamEnabled: true,
      wsStatus: client.getWsStatus(),
      serverTime: Date.now(),
    });
  }

  if (path === '/api/market/refresh') {
    await client.hydrateWatchlistFromLse().catch(() => undefined);
    return json({ symbols: client.getAllSymbols(), wsStatus: client.getWsStatus() });
  }

  if (path === '/api/market/candles') {
    try {
      const symbolKey = url.searchParams.get('symbol') || 'NASDAQ100';
      const market = url.searchParams.get('market') || undefined;
      const httpSymbol = url.searchParams.get('httpSymbol') || undefined;
      const timeframe = url.searchParams.get('timeframe') || '1m';
      const range = url.searchParams.get('range') || '1D';
      const toDate = url.searchParams.get('toDate') || undefined;
      const adjusted = url.searchParams.get('adjusted') !== '0';
      const ethSession = url.searchParams.get('eth') === 'RTH' ? 'RTH' : 'ETH';

      const result = await client.getCandles({
        symbolKey,
        market,
        httpSymbol,
        timeframe,
        range,
        toDate,
        adjusted,
      });
      const candles = filterCandlesBySession(result.candles, ethSession);
      return json({
        symbol: result.symbol,
        market: result.market,
        httpSymbol: result.httpSymbol,
        timeframe: result.timeframe,
        candles,
        source: result.source,
        from: result.from,
        to: result.to,
      });
    } catch (err) {
      return errorJson((err as Error).message || 'Failed to load candles from LSE Data 3.0');
    }
  }

  if (path === '/api/market/subscribe' && (method === 'POST' || method === 'PUT')) {
    try {
      const body = (await request.json()) as { market?: string; symbol?: string; name?: string };
      const pairSymbol = String(body?.symbol || '').trim();
      if (!pairSymbol) return errorJson('symbol is required', 400);
      const sym = await client.subscribeAndHydrate(
        String(body?.market || 'us_stocks'),
        pairSymbol,
        String(body?.name || pairSymbol)
      );
      return json({ symbol: sym, wsStatus: client.getWsStatus() });
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/ws/reconnect') {
    return json({ wsStatus: client.getWsStatus() });
  }

  if (path === '/api/lse/usage') {
    try {
      const usage = await client.fetchJson<Record<string, unknown>>('/v3/usage', 15_000);
      return json({ ...usage, ws: client.getWsStatus() });
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/markets') {
    try {
      return json(await client.fetchJson('/v3/markets', 5 * 60_000));
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/pairs') {
    try {
      const market = url.searchParams.get('market') || 'us_stocks';
      const q = (url.searchParams.get('q') || '').trim();
      const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || 40));
      const qs = new URLSearchParams({ market, limit: String(limit) });
      if (q) qs.set('q', q);
      return json(await client.fetchJson(`/v3/pairs?${qs.toString()}`, 2 * 60_000));
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/details') {
    const symbolKey = url.searchParams.get('symbol') || 'NASDAQ100';
    const sym = client.getSymbol(symbolKey);
    const market = url.searchParams.get('market') || sym?.lseMarket || 'futures';
    const httpSymbol = url.searchParams.get('httpSymbol') || sym?.lseHttpSymbol || 'NASDAQ100';

    const [overviewRes, factorsRes, profileRes] = await Promise.allSettled([
      client.fetchJson<{ history?: unknown }>(
        `/v3/overview?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      client.fetchJson<{ dividends?: unknown[]; splits?: unknown[] }>(
        `/v3/factors?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      market === 'us_stocks'
        ? client.fetchJson<{ rows?: Array<Record<string, unknown>> }>(
            `/v3/reference/preview?dataset=company_profiles&symbol=${encodeURIComponent(httpSymbol)}&limit=1`,
            10 * 60_000
          )
        : Promise.resolve({ rows: [] as Array<Record<string, unknown>> }),
    ]);

    const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
    const factors = factorsRes.status === 'fulfilled' ? factorsRes.value : null;
    const profileRows = profileRes.status === 'fulfilled' ? profileRes.value?.rows || [] : [];
    return json({
      symbol: sym?.symbol || symbolKey,
      market,
      httpSymbol,
      history: overview?.history || null,
      factors: factors
        ? {
            dividendsCount: Array.isArray(factors.dividends) ? factors.dividends.length : 0,
            recentDividends: Array.isArray(factors.dividends) ? factors.dividends.slice(0, 8) : [],
            splits: Array.isArray(factors.splits) ? factors.splits.slice(0, 8) : [],
          }
        : null,
      profile: profileRows[0] || null,
    });
  }

  if (path === '/api/lse/calendar') {
    try {
      const limit = Math.min(60, Math.max(5, Number(url.searchParams.get('limit')) || 30));
      return json(
        await client.fetchJson(`/v3/reference/preview?dataset=economic_calendar&limit=${limit}`, 3 * 60_000)
      );
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/bond-yields') {
    try {
      const limit = Math.min(60, Math.max(5, Number(url.searchParams.get('limit')) || 30));
      const [yieldsRes, macroRes] = await Promise.allSettled([
        client.fetchJson<{ rows?: unknown[] }>(
          `/v3/reference/preview?dataset=bond_yields&limit=${limit}`,
          5 * 60_000
        ),
        client.fetchJson<Record<string, unknown>>('/v3/macro', 10 * 60_000),
      ]);
      return json({
        rows: yieldsRes.status === 'fulfilled' ? yieldsRes.value.rows || [] : [],
        macro: macroRes.status === 'fulfilled' ? macroRes.value : null,
      });
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/estimate') {
    try {
      const market = url.searchParams.get('market') || 'futures';
      const symbol = url.searchParams.get('symbol') || 'NASDAQ100';
      const timeframe = url.searchParams.get('timeframe') || '1m';
      const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
      const from =
        url.searchParams.get('from') || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10);
      const qs = new URLSearchParams({ market, symbol, timeframe, from, to });
      return json(await client.fetchJson(`/v3/estimate?${qs.toString()}`, 30_000));
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/export') {
    try {
      const market = url.searchParams.get('market') || 'futures';
      const symbol = url.searchParams.get('symbol') || 'NASDAQ100';
      const timeframe = url.searchParams.get('timeframe') || '1m';
      const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
      const from =
        url.searchParams.get('from') || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10);
      const adjusted = url.searchParams.get('adjusted') !== '0';
      const csv = await client.exportRawCsv({ market, symbol, timeframe, from, to, adjusted });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${symbol}_${timeframe}_${from}_to_${to}.csv"`,
        },
      });
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/options/chain') {
    try {
      return json(
        await client.getOptionsChain({
          underlying: url.searchParams.get('underlying') || 'AAPL',
          contractType: url.searchParams.get('contract_type') || undefined,
          expiry: url.searchParams.get('expiry') || undefined,
          limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 250,
        })
      );
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/options/flow') {
    try {
      return json(
        await client.getOptionsFlow({
          underlying: url.searchParams.get('underlying') || undefined,
          minPremium: url.searchParams.get('min_premium') ? Number(url.searchParams.get('min_premium')) : undefined,
          limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 60,
        })
      );
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  if (path === '/api/lse/options/gex') {
    try {
      return json(
        await client.getOptionsGexDashboard({
          underlying: url.searchParams.get('underlying') || 'SPY',
          expiry: url.searchParams.get('expiry') || undefined,
          horizon: url.searchParams.get('horizon') || undefined,
          flowScope: url.searchParams.get('flow_scope') === 'all' ? 'all' : '0dte',
        })
      );
    } catch (err) {
      return errorJson((err as Error).message);
    }
  }

  return errorJson(`Unknown API route: ${path}`, 404);
}

/** Shared API entry point for the Worker and the Cloudflare Pages Functions adapter. */
export async function handleApiRequest(request: Request, env: Env): Promise<Response | null> {
  try {
    return await handleApi(request, env, new URL(request.url));
  } catch (err) {
    return errorJson((err as Error).message || 'Internal error', 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const apiResponse = await handleApiRequest(request, env);
    if (apiResponse) return apiResponse;

    // Static SPA assets, with index.html fallback for client-side routes
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === 'GET') {
      const indexUrl = new URL('/', url);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }
    return assetResponse;
  },
};
