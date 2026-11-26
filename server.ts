import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { createHash } from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { filterCandlesBySession } from './src/utils/marketEngine.ts';
import { LseClient } from './src/server/lseClient.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  const lseApiKey = process.env.LSE_API_KEY || '';
  const lse = new LseClient(lseApiKey);
  let liveStreamEnabled = true;
  let tickSequence = 1;
  let lastClientActivityAt = 0;
  let activePrioritySymbols: string[] = ['NASDAQ100', 'BTCUSDT'];

  interface RecentTickEvent {
    seq: number;
    tick: ReturnType<LseClient['getAllSymbols']>[number];
    rawTick: {
      symbol: string;
      price: number;
      bid: number;
      ask: number;
      volume: number;
      ts: string;
      sourceSocket: 'data-ws' | 'london-ws';
    };
    timestamp: number;
  }
  const recentTicks: RecentTickEvent[] = [];

  // Hydrate initial watchlist prices from LSE Data 3.0 REST API on boot
  lse.hydrateWatchlistFromLse().catch((err) => {
    console.warn('[LSE] Initial watchlist hydration skipped:', err?.message || err);
  });

  // WebSocket Server attached to HTTP Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws/market' });

  const broadcast = (payload: Record<string, unknown>) => {
    const msg = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  };

  const handleLseTick = (
    updatedSymbol: ReturnType<LseClient['getAllSymbols']>[number],
    rawTick: RecentTickEvent['rawTick']
  ) => {
    if (!liveStreamEnabled) return;
    const seq = ++tickSequence;
    const timestamp = Date.now();
    recentTicks.push({ seq, tick: updatedSymbol, rawTick, timestamp });
    if (recentTicks.length > 150) {
      recentTicks.splice(0, recentTicks.length - 150);
    }
    broadcast({
      type: 'market:tick',
      seq,
      tick: updatedSymbol,
      rawTick,
      timestamp,
    });
  };

  // Start upstream LSE WebSockets on-demand only while browser clients are active,
  // and release after 45s idle so Preview & Published don't fight over LSE's 1-connection slot.
  const ensureLiveFeedActive = () => {
    lastClientActivityAt = Date.now();
    if (!lse.isWebSocketsActive() && lse.hasKey()) {
      lse.startWebSockets(handleLseTick);
    }
  };

  // Heartbeat keep-alive for Cloud Run / mobile WebSocket clients + idle upstream WS release + Vault fallback
  const clientAliveMap = new WeakMap<WebSocket, boolean>();
  const wsKeepAliveTimer = setInterval(() => {
    for (const client of wss.clients) {
      if (clientAliveMap.get(client) === false) {
        try {
          client.terminate();
        } catch {
          // ignore
        }
        continue;
      }
      clientAliveMap.set(client, false);
      try {
        client.ping();
      } catch {
        // ignore
      }
    }

    const hasActiveClients = wss.clients.size > 0 || Date.now() - lastClientActivityAt < 45_000;
    if (!hasActiveClients && lse.isWebSocketsActive()) {
      lse.stopWebSockets();
    }
  }, 20_000);

  // Automatic server-side Vault live poller if upstream WS is silent/contested while clients are watching
  const fallbackPollTimer = setInterval(() => {
    if (!liveStreamEnabled || !lse.hasKey()) return;
    const hasActiveClients = wss.clients.size > 0 || Date.now() - lastClientActivityAt < 45_000;
    if (!hasActiveClients) return;
    const lastTick = lse.getLastTickAt() || 0;
    const wsStatus = lse.getWsStatus();
    const upstreamHealthy =
      (wsStatus.dataWs === 'authenticated' || wsStatus.londonWs === 'authenticated') &&
      Date.now() - lastTick < 8_000;
    if (!upstreamHealthy) {
      void lse.pollLiveQuotesFallback(activePrioritySymbols);
    }
  }, 4_500);

  wss.on('connection', (ws) => {
    clientAliveMap.set(ws, true);
    ensureLiveFeedActive();

    ws.on('pong', () => {
      clientAliveMap.set(ws, true);
      lastClientActivityAt = Date.now();
    });

    ws.send(
      JSON.stringify({
        type: 'market:init',
        symbols: lse.getAllSymbols(),
        liveStreamEnabled,
        wsStatus: lse.getWsStatus(),
        seq: tickSequence,
        serverTime: Date.now(),
      })
    );

    ws.on('message', (raw) => {
      lastClientActivityAt = Date.now();
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'feed:toggle') {
          liveStreamEnabled =
            typeof data.enabled === 'boolean' ? data.enabled : !liveStreamEnabled;
          lse.setStreamPaused(!liveStreamEnabled);
          broadcast({
            type: 'feed:status',
            liveStreamEnabled,
            wsStatus: lse.getWsStatus(),
          });
        } else if (data.type === 'ws:reconnect') {
          ensureLiveFeedActive();
          lse.reconnectWebSockets();
          broadcast({
            type: 'feed:status',
            liveStreamEnabled,
            wsStatus: lse.getWsStatus(),
          });
        } else if (data.type === 'client:active_symbols' && Array.isArray(data.symbols)) {
          const valid = data.symbols
            .map((s: unknown) => String(s || '').trim())
            .filter(Boolean)
            .slice(0, 8);
          if (valid.length > 0) {
            activePrioritySymbols = valid;
            for (const symKey of valid) {
              const sym = lse.getSymbol(symKey);
              if (sym) lse.ensureSubscribed(sym);
            }
          }
        } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() }));
        }
      } catch {
        // Ignore malformed client message
      }
    });
  });

  // --- Auth Client IP Detection Endpoint (New IP Login Gate) ---
  app.get('/api/auth/client-ip', (req, res) => {
    const xff = req.headers['x-forwarded-for'];
    const forwardedIp =
      typeof xff === 'string'
        ? xff.split(',')[0]?.trim()
        : Array.isArray(xff)
        ? xff[0]?.split(',')[0]?.trim()
        : '';
    const rawIp = forwardedIp || req.socket?.remoteAddress || '127.0.0.1';
    const normalizedIp =
      rawIp
        .replace(/^::ffff:/i, '')
        .replace(/[^0-9a-fA-F.:]/g, '')
        .slice(0, 64)
        .trim() || '127.0.0.1';

    // Privacy-preserving masked label for UI & Firestore storage
    let maskedIp = normalizedIp;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedIp)) {
      const parts = normalizedIp.split('.');
      maskedIp = `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    } else if (normalizedIp.includes(':')) {
      const segs = normalizedIp.split(':');
      maskedIp = `${segs.slice(0, 3).join(':')}:xxxx`;
    }

    const ipHash = `ip_${createHash('sha256')
      .update(normalizedIp)
      .digest('hex')
      .slice(0, 32)}`;

    const ua = String(req.headers['user-agent'] || '');
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

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      ipDisplay: normalizedIp,
      maskedIp,
      ipHash,
      deviceLabel: `${browser} on ${os}`,
      detectedAt: Date.now(),
    });
  });

  // --- Market Data REST Endpoints ---

  app.get('/api/market/snapshot', (_req, res) => {
    ensureLiveFeedActive();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      symbols: lse.getAllSymbols(),
      serverTime: Date.now(),
      liveStreamEnabled,
      wsStatus: lse.getWsStatus(),
      seq: tickSequence,
      apiConfigured: lse.hasKey(),
    });
  });

  // Live HTTP polling fallback endpoint (ensures real-time ticks work even when published proxy drops WS)
  app.get('/api/market/live', async (req, res) => {
    ensureLiveFeedActive();
    const since = Math.max(0, Number(req.query.since) || 0);
    const symbolsParam = String(req.query.symbols || '').trim();
    if (symbolsParam) {
      const requested = symbolsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);
      if (requested.length > 0) {
        activePrioritySymbols = requested;
        for (const key of requested) {
          const sym = lse.getSymbol(key);
          if (sym) lse.ensureSubscribed(sym);
        }
      }
    }

    const lastTick = lse.getLastTickAt() || 0;
    if (liveStreamEnabled && lse.hasKey() && Date.now() - lastTick > 5_000) {
      await lse.pollLiveQuotesFallback(activePrioritySymbols);
    }

    const deltaTicks = since > 0 ? recentTicks.filter((t) => t.seq > since).slice(-40) : recentTicks.slice(-16);
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      symbols: lse.getAllSymbols(),
      ticks: deltaTicks,
      seq: tickSequence,
      liveStreamEnabled,
      wsStatus: lse.getWsStatus(),
      serverTime: Date.now(),
    });
  });

  app.post('/api/market/refresh', async (_req, res) => {
    try {
      await lse.hydrateWatchlistFromLse();
      const all = lse.getAllSymbols();
      broadcast({
        type: 'market:init',
        symbols: all,
        liveStreamEnabled,
        wsStatus: lse.getWsStatus(),
        serverTime: Date.now(),
      });
      res.json({ symbols: all, wsStatus: lse.getWsStatus() });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/market/candles', async (req, res) => {
    try {
      const symbolKey = String(req.query.symbol || 'NASDAQ100');
      const market = req.query.market ? String(req.query.market) : undefined;
      const httpSymbol = req.query.httpSymbol ? String(req.query.httpSymbol) : undefined;
      const timeframe = String(req.query.timeframe || '1m');
      const range = String(req.query.range || '1D');
      const toDate = req.query.toDate ? String(req.query.toDate) : undefined;
      const adjusted = req.query.adjusted !== '0';
      const ethSession = req.query.eth === 'RTH' ? 'RTH' : 'ETH';

      const result = await lse.getCandles({
        symbolKey,
        market,
        httpSymbol,
        timeframe,
        range,
        toDate,
        adjusted,
      });

      const candles = filterCandlesBySession(result.candles, ethSession);
      const sym = lse.getSymbol(result.symbol);
      if (sym) {
        lse.ensureSubscribed(sym);
      }

      res.json({
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
      res.status(502).json({
        error: (err as Error).message || 'Failed to load candles from LSE Data 3.0',
      });
    }
  });

  app.post('/api/market/subscribe', async (req, res) => {
    try {
      const market = String(req.body?.market || 'us_stocks');
      const pairSymbol = String(req.body?.symbol || '').trim();
      const pairName = String(req.body?.name || pairSymbol).trim();
      if (!pairSymbol) {
        res.status(400).json({ error: 'symbol is required' });
        return;
      }
      const sym = await lse.subscribeAndHydrate(market, pairSymbol, pairName);
      broadcast({
        type: 'symbol:added',
        symbol: sym,
        symbols: lse.getAllSymbols(),
      });
      res.json({ symbol: sym, wsStatus: lse.getWsStatus() });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // --- LSE Data 3.0 Metadata, Reference, Macro & Export Endpoints ---

  app.get('/api/lse/usage', async (_req, res) => {
    try {
      const usage = await lse.fetchJson<Record<string, unknown>>('/v3/usage', 15_000);
      res.json({
        ...usage,
        ws: lse.getWsStatus(),
      });
    } catch (err) {
      res.status(502).json({
        error: (err as Error).message,
        ws: lse.getWsStatus(),
      });
    }
  });

  app.post('/api/lse/ws/reconnect', (_req, res) => {
    lse.reconnectWebSockets();
    res.json({ wsStatus: lse.getWsStatus() });
  });

  app.get('/api/lse/markets', async (_req, res) => {
    try {
      const data = await lse.fetchJson('/v3/markets', 5 * 60_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/pairs', async (req, res) => {
    try {
      const market = String(req.query.market || 'us_stocks');
      const q = String(req.query.q || '').trim();
      const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 40));
      const qs = new URLSearchParams({ market, limit: String(limit) });
      if (q) qs.set('q', q);
      const data = await lse.fetchJson(`/v3/pairs?${qs.toString()}`, 2 * 60_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/details', async (req, res) => {
    const symbolKey = String(req.query.symbol || 'NASDAQ100');
    const sym = lse.getSymbol(symbolKey);
    const market = String(req.query.market || sym?.lseMarket || 'futures');
    const httpSymbol = String(req.query.httpSymbol || sym?.lseHttpSymbol || 'NASDAQ100');

    const [overviewRes, factorsRes, profileRes] = await Promise.allSettled([
      lse.fetchJson<{ history?: { first: string; last: string; rows: number; timeframe: string } }>(
        `/v3/overview?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      lse.fetchJson<{
        dividends?: Array<{ ex_date?: string; amount?: number; currency?: string; declaration_date?: string }>;
        splits?: Array<{ date?: string; numerator?: number; denominator?: number; ratio?: string }>;
      }>(
        `/v3/factors?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(httpSymbol)}`,
        5 * 60_000
      ),
      market === 'us_stocks'
        ? lse.fetchJson<{ rows?: Array<Record<string, unknown>> }>(
            `/v3/reference/preview?dataset=company_profiles&symbol=${encodeURIComponent(httpSymbol)}&limit=1`,
            10 * 60_000
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const overview = overviewRes.status === 'fulfilled' ? overviewRes.value : null;
    const factors = factorsRes.status === 'fulfilled' ? factorsRes.value : null;
    const profileRows = profileRes.status === 'fulfilled' ? profileRes.value?.rows || [] : [];

    res.json({
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
  });

  app.get('/api/lse/calendar', async (req, res) => {
    try {
      const limit = Math.min(60, Math.max(5, Number(req.query.limit) || 30));
      const data = await lse.fetchJson<{ rows?: unknown[] }>(
        `/v3/reference/preview?dataset=economic_calendar&limit=${limit}`,
        3 * 60_000
      );
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/bond-yields', async (req, res) => {
    try {
      const limit = Math.min(60, Math.max(5, Number(req.query.limit) || 30));
      const [yieldsRes, macroRes] = await Promise.allSettled([
        lse.fetchJson<{ rows?: unknown[] }>(
          `/v3/reference/preview?dataset=bond_yields&limit=${limit}`,
          5 * 60_000
        ),
        lse.fetchJson<Record<string, unknown>>('/v3/macro', 10 * 60_000),
      ]);
      res.json({
        rows: yieldsRes.status === 'fulfilled' ? yieldsRes.value.rows || [] : [],
        macro: macroRes.status === 'fulfilled' ? macroRes.value : null,
      });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/estimate', async (req, res) => {
    try {
      const market = String(req.query.market || 'futures');
      const symbol = String(req.query.symbol || 'NASDAQ100');
      const timeframe = String(req.query.timeframe || '1m');
      const from = String(req.query.from || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10));
      const to = String(req.query.to || new Date().toISOString().slice(0, 10));
      const qs = new URLSearchParams({ market, symbol, timeframe, from, to });
      const data = await lse.fetchJson(`/v3/estimate?${qs.toString()}`, 30_000);
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/export', async (req, res) => {
    try {
      const market = String(req.query.market || 'futures');
      const symbol = String(req.query.symbol || 'NASDAQ100');
      const timeframe = String(req.query.timeframe || '1m');
      const from = String(req.query.from || new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10));
      const to = String(req.query.to || new Date().toISOString().slice(0, 10));
      const adjusted = req.query.adjusted !== '0';

      const csv = await lse.exportRawCsv({ market, symbol, timeframe, from, to, adjusted });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${symbol}_${timeframe}_${from}_to_${to}.csv"`
      );
      res.send(csv);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/chain', async (req, res) => {
    try {
      const underlying = String(req.query.underlying || 'AAPL');
      const contractType = req.query.contract_type ? String(req.query.contract_type) : undefined;
      const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 250;
      const data = await lse.getOptionsChain({ underlying, contractType, expiry, limit });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/flow', async (req, res) => {
    try {
      const underlying = req.query.underlying ? String(req.query.underlying) : undefined;
      const minPremium = req.query.min_premium ? Number(req.query.min_premium) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 60;
      const data = await lse.getOptionsFlow({ underlying, minPremium, limit });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  app.get('/api/lse/options/gex', async (req, res) => {
    try {
      const underlying = String(req.query.underlying || 'SPY');
      const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
      const horizon = req.query.horizon ? String(req.query.horizon) : undefined;
      const flowScope = req.query.flow_scope === 'all' ? 'all' : '0dte';
      const data = await lse.getOptionsGexDashboard({ underlying, expiry, horizon, flowScope });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // --- Vite / Static Assets ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const shutdown = () => {
    clearInterval(wsKeepAliveTimer);
    clearInterval(fallbackPollTimer);
    lse.stopWebSockets();
    httpServer.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TradingView Supercharts + LSE Data 3.0 server running on http://localhost:${PORT}`);
  });
}

startServer();
