// The `ws` package is only needed by the standalone Node server. It is imported
// lazily by name so Worker/Pages bundles (no Node sockets) still build; there the
// bridge simply stays disabled and the HTTP polling fallback is used.
interface WsLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: string, listener: (...args: any[]) => void): void;
}
type WsCtor = new (url: string) => WsLike;
const WS_OPEN = 1;

let wsCtor: WsCtor | null = null;
async function loadWsCtor(): Promise<WsCtor | null> {
  if (wsCtor) return wsCtor;
  try {
    const specifier = 'ws';
    const mod: any = await import(/* @vite-ignore */ specifier);
    wsCtor = (mod?.WebSocket ?? mod?.default ?? null) as WsCtor | null;
  } catch {
    wsCtor = null;
  }
  return wsCtor;
}
import {
  CandleBar,
  INITIAL_SYMBOLS,
  SymbolInfo,
  formatOptionContractLabel,
  mapTimeframeToLse,
  mergeCandleStreams,
  mergeTickIntoCandles,
  normalizeOccSymbol,
  parseLseTimeToUnix,
  resampleCandlesByTime,
  roundToTick,
} from '../utils/marketEngine.ts';
import {
  GexDashboardData,
  GexHorizonMode,
  GexHorizonSummary,
  OptionChainContract,
  OptionFlowPrint,
} from '../types/trading.ts';
import {
  addTradingDaysEt,
  buildGexDashboardData,
  computeLiveDte,
  computeTradingDaysBetween,
  getActiveOptionsSessionDateEt,
  getEtDateString,
  getMonthlyOpExCandidates,
} from '../utils/gexEngine.ts';

const LSE_REST_HOST = 'https://download.londonstrategicedge.com';
const LSE_VAULT_HOST = 'https://api.londonstrategicedge.com';
const LSE_DATA_WS_URL = 'wss://data-ws.londonstrategicedge.com';
const LSE_LONDON_WS_URL = 'wss://london-ws.londonstrategicedge.com';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Minimum gap between two upstream live-quote polls for the same symbol.
const LIVE_POLL_MIN_INTERVAL_MS = 1_000;

export interface LseTickPayload {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  ts: string;
  sourceSocket: 'data-ws' | 'london-ws';
}

export class LseClient {
  private apiKey: string;
  private cache = new Map<string, CacheEntry<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  private exportQueue: Promise<void> = Promise.resolve();
  private vaultActiveCount = 0;
  private vaultWaiters: Array<() => void> = [];
  private vaultSymbolCache = new Map<string, string>();

  // Market symbol registry keyed by UI symbol (e.g. 'NASDAQ100', 'AAPL', 'ETHUSDT')
  public symbols = new Map<string, SymbolInfo>();
  private wsToUiSymbol = new Map<string, string>();
  private liveBars1m = new Map<string, CandleBar[]>();
  private liveBars1s = new Map<string, CandleBar[]>();

  // Upstream WebSocket bridges
  private dataWs: WsLike | null = null;
  private londonWs: WsLike | null = null;
  private dataWsState: 'disconnected' | 'connecting' | 'authenticated' | 'error' = 'disconnected';
  private londonWsState: 'disconnected' | 'connecting' | 'authenticated' | 'error' = 'disconnected';
  private subscribedDataWs = new Set<string>();
  private subscribedLondonWs = new Set<string>();
  private desiredDataWs: string[] = [];
  private desiredLondonWs: string[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimers: Array<ReturnType<typeof setTimeout>> = [];
  private maxSubscriptions = 16;
  private lastTickAt: number | null = null;
  private lastWsError: string | null = null;
  private intentionalStop = false;
  private wsActive = false;
  // Per-symbol timestamp of the last live-quote poll, so several browser clients polling
  // the same symbol share one upstream REST call instead of multiplying it.
  private livePollAtBySymbol = new Map<string, number>();
  private onTickCallback: ((sym: SymbolInfo, rawTick: LseTickPayload) => void) | null = null;
  private isPaused = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim();
    for (const sym of INITIAL_SYMBOLS) {
      this.registerSymbol({ ...sym });
    }
  }

  public hasKey(): boolean {
    return this.apiKey.length > 0;
  }

  public registerSymbol(sym: SymbolInfo): SymbolInfo {
    const existing = this.symbols.get(sym.symbol);
    const merged: SymbolInfo = existing ? { ...existing, ...sym } : { ...sym };
    this.symbols.set(merged.symbol, merged);
    if (merged.lseWsSymbol) {
      this.wsToUiSymbol.set(merged.lseWsSymbol.toUpperCase(), merged.symbol);
    }
    return merged;
  }

  public getAllSymbols(): SymbolInfo[] {
    return Array.from(this.symbols.values());
  }

  public getSymbol(symbolKey: string): SymbolInfo | undefined {
    return this.symbols.get(symbolKey) || this.symbols.get(symbolKey.toUpperCase());
  }

  public setStreamPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public getWsStatus() {
    return {
      dataWs: this.dataWsState,
      londonWs: this.londonWsState,
      subscribedCount: this.subscribedDataWs.size + this.subscribedLondonWs.size,
      maxSubscriptions: this.maxSubscriptions,
      subscribedSymbols: [
        ...Array.from(this.subscribedDataWs),
        ...Array.from(this.subscribedLondonWs),
      ],
      lastTickAt: this.lastTickAt,
      lastError: this.lastWsError,
      active: this.wsActive,
      paused: this.isPaused,
    };
  }

  public isWebSocketsActive(): boolean {
    return this.wsActive;
  }

  public getLastTickAt(): number | null {
    return this.lastTickAt;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      return null;
    }
    return entry.value as T;
  }

  private setCached<T>(key: string, value: T, ttlMs: number) {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  private async fetchText(pathAndQuery: string): Promise<{ status: number; text: string; headers: Record<string, string | string[] | undefined> }> {
    if (!this.apiKey) {
      throw new Error('LSE_API_KEY is not configured on the server.');
    }
    // Plain fetch keeps this client portable between Node and Cloudflare Workers.
    const res = await fetch(`${LSE_REST_HOST}${pathAndQuery}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        Accept: 'application/json, text/csv, */*',
      },
      signal: AbortSignal.timeout(22_000),
    });
    const text = await res.text();
    return { status: res.status, text, headers: {} };
  }

  public async fetchJson<T = Record<string, unknown>>(
    pathAndQuery: string,
    ttlMs: number = 60_000
  ): Promise<T> {
    const cacheKey = `json:${pathAndQuery}`;
    const cached = this.getCached<T>(cacheKey);
    if (cached) return cached;

    const existingFlight = this.inFlight.get(cacheKey);
    if (existingFlight) return existingFlight as Promise<T>;

    const task = (async () => {
      const res = await this.fetchText(pathAndQuery);
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.text);
      } catch {
        throw new Error(`LSE returned non-JSON (${res.status}): ${res.text.slice(0, 180)}`);
      }
      if (res.status >= 400) {
        const errObj = parsed as { code?: string; message?: string };
        const err = new Error(errObj?.message || `LSE error ${res.status}`);
        (err as Error & { status?: number; code?: string }).status = res.status;
        (err as Error & { status?: number; code?: string }).code = errObj?.code;
        throw err;
      }
      this.setCached(cacheKey, parsed, ttlMs);
      return parsed as T;
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  /**
   * Executes an HTTP GET against the LSE Vault live/intraday API (api.londonstrategicedge.com).
   */
  private async fetchVaultText(pathAndQuery: string): Promise<{ status: number; text: string }> {
    if (!this.apiKey) {
      throw new Error('LSE_API_KEY is not configured on the server.');
    }
    const res = await fetch(`${LSE_VAULT_HOST}${pathAndQuery}`, {
      method: 'GET',
      headers: {
        'X-API-Key': this.apiKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });
    return { status: res.status, text: await res.text() };
  }

  /**
   * Limits concurrent /vault/candles requests to 2 slots (matching vault_concurrency: 2).
   */
  private async runVaultQueued<T>(fn: () => Promise<T>): Promise<T> {
    if (this.vaultActiveCount >= 2) {
      await new Promise<void>((resolve) => this.vaultWaiters.push(resolve));
    }
    this.vaultActiveCount++;
    try {
      return await fn();
    } finally {
      this.vaultActiveCount--;
      const next = this.vaultWaiters.shift();
      if (next) next();
    }
  }

  /**
   * Serializes /v3/export calls through a promise mutex so the free plan's
   * 1-concurrent-export limit never throws 429 connections-exhausted.
   */
  private runSerializedExport<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.exportQueue.then(fn, fn);
    this.exportQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  /**
   * Maps a market + pair symbol from /v3/pairs into a full UI SymbolInfo + WebSocket routing metadata.
   */
  public mapPairToSymbolInfo(market: string, pairSymbol: string, pairName: string): SymbolInfo {
    // Check if it corresponds to one of our canonical symbols first
    const byHttp = Array.from(this.symbols.values()).find(
      (s) => s.lseMarket === market && s.lseHttpSymbol.toUpperCase() === pairSymbol.toUpperCase()
    );
    if (byHttp) return byHttp;

    let uiType: SymbolInfo['type'] = 'Stock';
    let exchange = 'US';
    let wsEndpoint: SymbolInfo['lseWsEndpoint'] = 'data-ws';
    let wsSymbol: string | undefined = pairSymbol;
    let decimals = 2;
    let tickSize = 0.01;
    let badgeBg = '#2962ff';

    switch (market) {
      case 'futures':
        uiType = 'Futures';
        exchange = 'CME/NYMEX';
        wsEndpoint = 'data-ws';
        wsSymbol = `${pairSymbol}.F`;
        badgeBg = '#0097a7';
        break;
      case 'crypto':
        uiType = 'Crypto';
        exchange = 'CRYPTO';
        wsEndpoint = 'london-ws';
        wsSymbol = pairSymbol.endsWith('USDT')
          ? `${pairSymbol.slice(0, -4)}/USD`
          : pairSymbol.endsWith('USD') && !pairSymbol.includes('/')
          ? `${pairSymbol.slice(0, -3)}/USD`
          : pairSymbol;
        badgeBg = '#f7931a';
        break;
      case 'forex':
        uiType = 'Forex';
        exchange = 'FX';
        wsEndpoint = 'data-ws';
        wsSymbol = pairSymbol.replace('_', '/');
        decimals = pairSymbol.includes('JPY') ? 3 : 5;
        tickSize = pairSymbol.includes('JPY') ? 0.001 : 0.00001;
        badgeBg = '#3949ab';
        break;
      case 'commodities':
        uiType = 'Commodity';
        exchange = 'OTC';
        wsEndpoint = 'data-ws';
        wsSymbol = pairSymbol;
        badgeBg = '#fbc02d';
        break;
      case 'indices':
        uiType = 'Index';
        exchange = 'INDEX';
        wsEndpoint = 'data-ws';
        wsSymbol = undefined;
        badgeBg = '#5c6bc0';
        break;
      case 'uk_stocks':
        uiType = 'Stock';
        exchange = 'LSE';
        wsEndpoint = 'london-ws';
        wsSymbol = pairSymbol.endsWith('.L') ? pairSymbol : `${pairSymbol}.L`;
        badgeBg = '#00897b';
        break;
      case 'ca_stocks':
        uiType = 'Stock';
        exchange = 'TSX';
        wsEndpoint = 'tsx-ws';
        wsSymbol = pairSymbol.endsWith('.TO') ? pairSymbol : `${pairSymbol}.TO`;
        badgeBg = '#e53935';
        break;
      case 'us_options':
        uiType = 'Options';
        exchange = 'OPRA';
        wsEndpoint = undefined;
        wsSymbol = undefined;
        badgeBg = '#8e24aa';
        decimals = 2;
        tickSize = 0.01;
        break;
      default:
        uiType = 'Stock';
        exchange = 'US';
        wsEndpoint = 'data-ws';
        wsSymbol = pairSymbol;
        badgeBg = '#2962ff';
        break;
    }

    const normalizedHttpSymbol =
      market === 'us_options' ? normalizeOccSymbol(pairSymbol) : pairSymbol;

    const uiKey =
      market === 'forex'
        ? pairSymbol.replace('_', '')
        : market === 'us_options'
        ? normalizedHttpSymbol.replace(/\s+/g, '')
        : pairSymbol.replace('/', '');

    const existing = this.symbols.get(uiKey);
    if (existing) return existing;

    const displayName =
      market === 'us_options' && (!pairName || pairName === pairSymbol)
        ? formatOptionContractLabel(normalizedHttpSymbol)
        : pairName || pairSymbol;

    const created: SymbolInfo = {
      symbol: uiKey,
      name: displayName,
      exchange,
      type: uiType,
      contractCode: market.toUpperCase(),
      currency: 'USD',
      price: 0,
      change: 0,
      changePercent: 0,
      bid: 0,
      ask: 0,
      spread: tickSize,
      tickSize,
      decimals,
      badgeText: market === 'us_options' ? 'OP' : uiKey.slice(0, 2).toUpperCase(),
      badgeBg,
      flagColor: null,
      volume24h: 0,
      dayHigh: 0,
      dayLow: 0,
      dayOpen: 0,
      lseMarket: market,
      lseHttpSymbol: normalizedHttpSymbol,
      lseWsSymbol: wsSymbol,
      lseWsEndpoint: wsEndpoint,
    };

    return this.registerSymbol(created);
  }

  /**
   * Hydrates latest real prices, daily opens, highs, lows, and % changes
   * for initial watchlist symbols using lightweight /v3/preview?timeframe=1d calls.
   */
  public async hydrateWatchlistFromLse(): Promise<void> {
    if (!this.apiKey) return;
    const list = Array.from(this.symbols.values());
    await Promise.allSettled(
      list.map(async (sym) => {
        try {
          const preview = await this.fetchJson<{
            rows?: Array<{
              time: string;
              open: number;
              high: number;
              low: number;
              close: number;
              volume?: number;
            }>;
          }>(
            `/v3/preview?market=${encodeURIComponent(sym.lseMarket)}&symbol=${encodeURIComponent(
              sym.lseHttpSymbol
            )}&timeframe=1d`,
            60_000
          );
          const rows = preview.rows || [];
          if (rows.length > 0) {
            const last = rows[rows.length - 1];
            const prev = rows.length >= 2 ? rows[rows.length - 2] : last;
            const refOpen = Number(prev.close) || Number(last.open);
            const price = Number(last.close);
            const change = Number((price - refOpen).toFixed(sym.decimals));
            const changePercent = refOpen > 0 ? Number(((change / refOpen) * 100).toFixed(2)) : 0;
            const halfSpread = sym.spread / 2;

            const existing = this.symbols.get(sym.symbol) || sym;
            const livePrice = existing.dataSource === 'lse-live' && existing.price > 0 ? existing.price : price;
            const liveChange = Number((livePrice - refOpen).toFixed(sym.decimals));
            const liveChangePct = refOpen > 0 ? Number(((liveChange / refOpen) * 100).toFixed(2)) : 0;

            const updated: SymbolInfo = {
              ...existing,
              price: livePrice,
              change: liveChange,
              changePercent: liveChangePct,
              bid: existing.dataSource === 'lse-live' && existing.bid > 0 ? existing.bid : roundToTick(livePrice - halfSpread, sym.tickSize, sym.decimals),
              ask: existing.dataSource === 'lse-live' && existing.ask > 0 ? existing.ask : roundToTick(livePrice + halfSpread, sym.tickSize, sym.decimals),
              dayHigh: Math.max(Number(last.high) || livePrice, existing.dayHigh || 0),
              dayLow: existing.dayLow > 0 ? Math.min(Number(last.low) || livePrice, existing.dayLow) : (Number(last.low) || livePrice),
              dayOpen: refOpen,
              volume24h: Math.max(Number(last.volume) || 0, existing.volume24h),
              lastTickTs: existing.dataSource === 'lse-live' ? existing.lastTickTs : last.time,
              dataSource: existing.dataSource === 'lse-live' ? 'lse-live' : 'lse-rest',
            };
            this.symbols.set(sym.symbol, updated);
          }
        } catch {
          // Keep existing quote state if preview fails
        }
      })
    );
  }

  /**
   * Parses LSE /v3/export CSV response into sorted CandleBar[]
   */
  private parseCandleCsv(csvText: string): CandleBar[] {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          out.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
    const idxTime = headers.indexOf('time');
    const idxOpen = headers.indexOf('open');
    const idxHigh = headers.indexOf('high');
    const idxLow = headers.indexOf('low');
    const idxClose = headers.indexOf('close');
    const idxVol = headers.indexOf('volume');

    if (idxTime === -1 || idxOpen === -1 || idxClose === -1) return [];

    const byTime = new Map<number, CandleBar>();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = parseLine(line);
      const t = parseLseTimeToUnix(cols[idxTime]);
      const open = parseFloat(cols[idxOpen]);
      const high = parseFloat(cols[idxHigh]);
      const low = parseFloat(cols[idxLow]);
      const close = parseFloat(cols[idxClose]);
      const volume = idxVol >= 0 ? parseFloat(cols[idxVol]) || 0 : 0;

      if (!Number.isFinite(t) || !Number.isFinite(open) || !Number.isFinite(close)) continue;
      byTime.set(t, {
        time: t,
        open,
        high: Number.isFinite(high) ? high : Math.max(open, close),
        low: Number.isFinite(low) ? low : Math.min(open, close),
        close,
        volume,
      });
    }

    return Array.from(byTime.values()).sort((a, b) => a.time - b.time);
  }

  /**
   * Computes conservative UTC YYYY-MM-DD window per timeframe + requested UI range
   * so charts get rich 150-350 bar history without wasting daily row limits.
   */
  private computeDateWindow(lseTimeframe: string, range: string, toDate?: string): { from: string; to: string } {
    const endDate = toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)
      ? new Date(`${toDate}T23:59:59Z`)
      : new Date();
    const toStr = endDate.toISOString().slice(0, 10);

    let lookbackDays = 3;
    if (lseTimeframe.endsWith('s')) {
      lookbackDays = 2;
    } else if (lseTimeframe === '1m') {
      lookbackDays = range === '5D' ? 6 : 3;
    } else if (lseTimeframe === '3m' || lseTimeframe === '5m') {
      lookbackDays = range === '5D' ? 8 : range === '1M' ? 14 : 5;
    } else if (lseTimeframe === '15m' || lseTimeframe === '30m') {
      lookbackDays = range === '1D' ? 5 : range === '5D' ? 10 : 21;
    } else if (lseTimeframe === '1h' || lseTimeframe === '4h') {
      lookbackDays = range === '1D' ? 7 : range === '5D' ? 14 : range === '1M' ? 35 : 75;
    } else if (lseTimeframe === '1d') {
      lookbackDays =
        range === '1D'
          ? 20
          : range === '5D'
          ? 30
          : range === '1M'
          ? 45
          : range === '3M'
          ? 100
          : range === '6M' || range === 'YTD'
          ? 200
          : 365;
    } else if (lseTimeframe === '1w') {
      lookbackDays = 365 * 2;
    } else if (lseTimeframe === '1mo') {
      lookbackDays = 365 * 4;
    }

    const fromDate = new Date(endDate.getTime() - lookbackDays * 86400 * 1000);
    const fromStr = fromDate.toISOString().slice(0, 10);
    return { from: fromStr, to: toStr };
  }

  private resolveVaultCandidates(sym: SymbolInfo): string[] {
    const cached = this.vaultSymbolCache.get(sym.symbol);
    const raw: Array<string | undefined> = [cached];
    if (sym.lseMarket === 'uk_stocks') {
      raw.push(`${sym.lseHttpSymbol}.UK`, sym.lseHttpSymbol, sym.lseWsSymbol);
    } else {
      raw.push(sym.lseWsSymbol, sym.lseHttpSymbol);
    }
    if (sym.lseMarket === 'crypto' && sym.lseHttpSymbol.endsWith('USDT')) {
      raw.push(`${sym.lseHttpSymbol.slice(0, -4)}/USD`);
    }
    if (sym.lseMarket === 'forex' && sym.lseHttpSymbol.includes('_')) {
      raw.push(sym.lseHttpSymbol.replace('_', '/'));
    }
    return Array.from(new Set(raw.filter((s): s is string => Boolean(s && s.trim()))));
  }

  private mapVaultTimeframe(lseTimeframe: string): { vaultTf: string; vaultBucketSeconds: number } {
    switch (lseTimeframe) {
      case '1s':
        return { vaultTf: '1s', vaultBucketSeconds: 1 };
      case '5s':
        return { vaultTf: '5s', vaultBucketSeconds: 5 };
      case '15s':
        return { vaultTf: '15s', vaultBucketSeconds: 15 };
      case '30s':
        return { vaultTf: '30s', vaultBucketSeconds: 30 };
      case '1m':
        return { vaultTf: '1m', vaultBucketSeconds: 60 };
      case '3m':
        return { vaultTf: '3m', vaultBucketSeconds: 180 };
      case '5m':
        return { vaultTf: '5m', vaultBucketSeconds: 300 };
      case '15m':
        return { vaultTf: '15m', vaultBucketSeconds: 900 };
      case '30m':
        return { vaultTf: '30m', vaultBucketSeconds: 1800 };
      case '1h':
        return { vaultTf: '1h', vaultBucketSeconds: 3600 };
      case '4h':
        return { vaultTf: '4h', vaultBucketSeconds: 14400 };
      case '1d':
      case '1w':
      case '1mo':
        return { vaultTf: '1d', vaultBucketSeconds: 86400 };
      default:
        return { vaultTf: '1m', vaultBucketSeconds: 60 };
    }
  }

  private async fetchVaultCandles(
    sym: SymbolInfo,
    vaultTf: string,
    startStr: string,
    endStr: string,
    limit: number = 5000,
    ttlMs: number = 12_000
  ): Promise<CandleBar[]> {
    const cacheKey = `vault:${sym.symbol}:${vaultTf}:${startStr}:${endStr}:${limit}`;
    const cached = this.getCached<CandleBar[]>(cacheKey);
    if (cached) return cached;

    const existingFlight = this.inFlight.get(cacheKey) as Promise<CandleBar[]> | undefined;
    if (existingFlight) return existingFlight;

    const task = (async (): Promise<CandleBar[]> => {
      const candidates = this.resolveVaultCandidates(sym);
      for (const candidate of candidates) {
        const qs = new URLSearchParams({
          symbol: candidate,
          timeframe: vaultTf,
          start: startStr,
          end: endStr,
          limit: String(limit),
        });
        const res = await this.runVaultQueued(() => this.fetchVaultText(`/vault/candles?${qs.toString()}`));
        if (res.status === 404) {
          continue;
        }
        if (res.status >= 400) {
          return [];
        }
        let rows: Array<{ ts?: string; time?: string; open: number; high: number; low: number; close: number; volume?: number }> = [];
        try {
          const parsed = JSON.parse(res.text);
          if (Array.isArray(parsed)) rows = parsed;
        } catch {
          return [];
        }
        this.vaultSymbolCache.set(sym.symbol, candidate);
        const byTime = new Map<number, CandleBar>();
        for (const r of rows) {
          const t = parseLseTimeToUnix(r.ts || r.time || '');
          const open = Number(r.open);
          const high = Number(r.high);
          const low = Number(r.low);
          const close = Number(r.close);
          const volume = Number(r.volume) || 0;
          if (!Number.isFinite(t) || !Number.isFinite(open) || !Number.isFinite(close)) continue;
          byTime.set(t, {
            time: t,
            open,
            high: Number.isFinite(high) ? high : Math.max(open, close),
            low: Number.isFinite(low) ? low : Math.min(open, close),
            close,
            volume,
          });
        }
        const sorted = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
        if (sorted.length > 0) {
          this.setCached(cacheKey, sorted, ttlMs);
        }
        return sorted;
      }
      return [];
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  /**
   * Fetches real OHLCV candles by combining historical LSE /v3/export archives
   * (completed UTC days) with /vault/candles live intraday history (today 00:00Z -> now)
   * and WebSocket liveBars1m ticks so there is zero candle gap between historical and live data.
   */
  public async getCandles(params: {
    symbolKey: string;
    market?: string;
    httpSymbol?: string;
    timeframe: string;
    range?: string;
    toDate?: string;
    adjusted?: boolean;
  }): Promise<{
    symbol: string;
    market: string;
    httpSymbol: string;
    timeframe: string;
    candles: CandleBar[];
    source: 'lse-export' | 'lse-vault' | 'lse-preview';
    from: string;
    to: string;
  }> {
    let sym = this.getSymbol(params.symbolKey);
    if (!sym && params.market && params.httpSymbol) {
      sym = this.mapPairToSymbolInfo(params.market, params.httpSymbol, params.httpSymbol);
    }
    if (!sym) {
      sym = INITIAL_SYMBOLS[0];
    }

    const market = params.market || sym.lseMarket;
    const rawHttpSymbol = params.httpSymbol || sym.lseHttpSymbol;
    const httpSymbol =
      market === 'us_options' ? normalizeOccSymbol(rawHttpSymbol) : rawHttpSymbol;
    const adjusted = params.adjusted !== false;
    const { lseTimeframe, bucketSeconds } = mapTimeframeToLse(params.timeframe);
    const { from, to } = this.computeDateWindow(lseTimeframe, params.range || '1D', params.toDate);
    const { vaultTf, vaultBucketSeconds } = this.mapVaultTimeframe(lseTimeframe);

    const tomorrowStr = new Date(Date.now() + 86400 * 1000).toISOString().slice(0, 10);
    const endWindowStr = params.toDate ? `${to} 23:59:59` : tomorrowStr;

    const cacheKey = `candles:${market}:${httpSymbol}:${lseTimeframe}:${from}:${to}:${adjusted ? 1 : 0}`;
    const cachedEntry = this.getCached<{ candles: CandleBar[]; source: 'lse-export' | 'lse-vault' | 'lse-preview' }>(cacheKey);
    let baseCandles = cachedEntry?.candles ?? null;
    let source: 'lse-export' | 'lse-vault' | 'lse-preview' = cachedEntry?.source ?? 'lse-export';

    // Dedicated historical + live loader for sub-minute seconds timeframes (1s, 5s, 15s, 30s, custom *s)
    // Anchors Vault query to latest real market bar timestamp so closed/weekend sessions still show recent history.
    if (!baseCandles && vaultBucketSeconds < 60 && !params.toDate) {
      let previewRows: CandleBar[] = [];
      try {
        const preview = await this.fetchJson<{
          rows?: Array<{
            time: string;
            open: number;
            high: number;
            low: number;
            close: number;
            volume?: number;
          }>;
        }>(
          `/v3/preview?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(
            httpSymbol
          )}&timeframe=${encodeURIComponent(lseTimeframe)}&adjusted=${adjusted ? '1' : '0'}`,
          15_000
        );
        previewRows = (preview.rows || [])
          .map((r) => ({
            time: parseLseTimeToUnix(r.time),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: Number(r.volume) || 0,
          }))
          .filter((b) => Number.isFinite(b.time) && Number.isFinite(b.open) && Number.isFinite(b.close))
          .sort((a, b) => a.time - b.time);
      } catch {
        // Ignore preview failure and rely on Vault / Export
      }

      if (market !== 'us_options') {
        try {
          const live1s = this.liveBars1s.get(sym.symbol) || [];
          const liveLast = live1s.length > 0 ? live1s[live1s.length - 1].time : 0;
          const previewLast = previewRows.length > 0 ? previewRows[previewRows.length - 1].time : 0;
          const anchorSec = Math.max(previewLast, liveLast) || Math.floor(Date.now() / 1000);
          const spanBars = params.range === '5D' ? 4800 : 3600;
          const vaultStartStr = new Date(
            Math.max(0, (anchorSec - spanBars * vaultBucketSeconds) * 1000)
          )
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');
          const vaultSecBars = await this.fetchVaultCandles(
            sym,
            vaultTf,
            vaultStartStr,
            tomorrowStr,
            5000,
            10_000
          );
          if (vaultSecBars.length > 0 || previewRows.length > 0) {
            baseCandles = mergeCandleStreams(vaultSecBars, previewRows);
            source = vaultSecBars.length > 0 ? 'lse-vault' : 'lse-preview';
          }
        } catch {
          if (previewRows.length > 0) {
            baseCandles = previewRows;
            source = 'lse-preview';
          }
        }
      } else if (previewRows.length > 0) {
        baseCandles = previewRows;
        source = 'lse-preview';
      }
    }

    // When fetching live intraday charts without a 5D multi-week 1m stretch, /vault/candles returns
    // continuous archive + live today candles in one call without burning daily /v3/export row quotas.
    const estimatedBars = Math.ceil(
      ((new Date(`${to}T23:59:59Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 1000) /
        Math.max(1, vaultBucketSeconds)
    );
    const preferVaultFullWindow =
      vaultBucketSeconds >= 60 &&
      market !== 'us_options' &&
      !params.toDate &&
      estimatedBars <= 4500 &&
      lseTimeframe !== '1w' &&
      lseTimeframe !== '1mo';

    if (!baseCandles && preferVaultFullWindow) {
      try {
        const vaultFull = await this.fetchVaultCandles(sym, vaultTf, from, endWindowStr, 5000, 12_000);
        if (vaultFull.length > 0 && vaultFull.length < 4990) {
          baseCandles = vaultFull;
          source = 'lse-vault';
        }
      } catch {
        // Fall through to /v3/export
      }
    }

    if (!baseCandles) {
      const existingFlight = this.inFlight.get(cacheKey) as
        | Promise<{ candles: CandleBar[]; source: 'lse-export' | 'lse-vault' | 'lse-preview' }>
        | undefined;
      if (existingFlight) {
        const res = await existingFlight;
        baseCandles = res.candles;
        source = res.source;
      } else {
        const flight = (async (): Promise<{
          candles: CandleBar[];
          source: 'lse-export' | 'lse-vault' | 'lse-preview';
        }> => {
          try {
            const qs = new URLSearchParams({
              market,
              symbol: httpSymbol,
              timeframe: lseTimeframe,
              from,
              to,
              adjusted: adjusted ? '1' : '0',
              format: 'csv',
            });
            const exportRes = await this.runSerializedExport(() =>
              this.fetchText(`/v3/export?${qs.toString()}`)
            );
            if (exportRes.status === 200) {
              const parsed = this.parseCandleCsv(exportRes.text);
              if (parsed.length > 0) {
                const clipped = vaultBucketSeconds < 60 && parsed.length > 4200 ? parsed.slice(-4200) : parsed;
                const entry = { candles: clipped, source: 'lse-export' as const };
                this.setCached(cacheKey, entry, 5 * 60_000);
                return entry;
              }
            }
          } catch {
            // Fall through to /vault/candles then /v3/preview
          }

          try {
            // Bound fallback start time so limit=5000 always includes the latest live bars up to now
            const maxSpanSec = Math.min(365 * 86400, vaultBucketSeconds * 4500);
            const boundedStart = new Date(Date.now() - maxSpanSec * 1000).toISOString().slice(0, 19).replace('T', ' ');
            const fallbackStart =
              vaultBucketSeconds < 60 || lseTimeframe === '1m' || estimatedBars > 4500 ? boundedStart : from;
            const vaultFallback = await this.fetchVaultCandles(
              sym,
              vaultTf,
              fallbackStart,
              endWindowStr,
              5000,
              15_000
            );
            if (vaultFallback.length > 0) {
              return { candles: vaultFallback, source: 'lse-vault' };
            }
          } catch {
            // Fall through to /v3/preview
          }

          const preview = await this.fetchJson<{
            rows?: Array<{
              time: string;
              open: number;
              high: number;
              low: number;
              close: number;
              volume?: number;
            }>;
          }>(
            `/v3/preview?market=${encodeURIComponent(market)}&symbol=${encodeURIComponent(
              httpSymbol
            )}&timeframe=${encodeURIComponent(lseTimeframe)}&adjusted=${adjusted ? '1' : '0'}`,
            45_000
          );
          const rows = (preview.rows || []).map((r) => ({
            time: parseLseTimeToUnix(r.time),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            volume: Number(r.volume) || 0,
          }));
          rows.sort((a, b) => a.time - b.time);
          const entry = { candles: rows, source: 'lse-preview' as const };
          if (rows.length > 0) {
            this.setCached(cacheKey, entry, 45_000);
          }
          return entry;
        })().finally(() => {
          this.inFlight.delete(cacheKey);
        });

        this.inFlight.set(cacheKey, flight);
        const res = await flight;
        baseCandles = res.candles;
        source = res.source;
      }
    }

    // Time-aligned resampling for derived sub-minute or multi-minute/daily+ intervals
    let resampledRest =
      bucketSeconds > vaultBucketSeconds || (bucketSeconds > 60 && source !== 'lse-vault')
        ? resampleCandlesByTime(baseCandles, bucketSeconds)
        : baseCandles;

    // Bridge any gap between completed /v3/export archive days (which end yesterday 23:59Z) and live WS now
    if (!params.toDate && source !== 'lse-vault' && market !== 'us_options' && vaultBucketSeconds >= 60) {
      try {
        const lastRestTime =
          resampledRest.length > 0
            ? resampledRest[resampledRest.length - 1].time
            : Math.floor(Date.now() / 1000) - 48 * 3600;
        const bridgeStartDate = new Date(Math.max(0, lastRestTime - Math.max(3600, bucketSeconds)) * 1000);
        const bridgeStartStr = bridgeStartDate.toISOString().slice(0, 19).replace('T', ' ');
        const vaultRecent = await this.fetchVaultCandles(
          sym,
          vaultTf,
          bridgeStartStr,
          tomorrowStr,
          5000,
          12_000
        );
        if (vaultRecent.length > 0) {
          const vaultResampled =
            bucketSeconds > vaultBucketSeconds ? resampleCandlesByTime(vaultRecent, bucketSeconds) : vaultRecent;
          resampledRest = mergeCandleStreams(resampledRest, vaultResampled);
        }
      } catch {
        // Keep archive + WS if vault bridge temporarily unavailable
      }
    }

    // Merge server-accumulated live WebSocket bars on top of REST+Vault history
    let liveForTf: CandleBar[] = [];
    if (bucketSeconds < 60) {
      const live1s = this.liveBars1s.get(sym.symbol) || [];
      liveForTf =
        live1s.length > 0
          ? bucketSeconds > 1
            ? resampleCandlesByTime(live1s, bucketSeconds)
            : live1s
          : [];
    } else {
      const live1m = this.liveBars1m.get(sym.symbol) || [];
      liveForTf =
        live1m.length > 0
          ? bucketSeconds > 60
            ? resampleCandlesByTime(live1m, bucketSeconds)
            : live1m
          : [];
    }
    const candles = mergeCandleStreams(resampledRest, liveForTf);

    // Keep latest symbol price synced with the last returned bar when no live tick arrived yet
    if (candles.length > 0 && sym.dataSource !== 'lse-live') {
      const last = candles[candles.length - 1];
      const baseSpread = Math.max(
        sym.tickSize,
        INITIAL_SYMBOLS.find((s) => s.symbol === sym.symbol)?.spread ?? sym.tickSize * 2
      );
      sym.price = last.close;
      sym.bid = roundToTick(last.close - baseSpread / 2, sym.tickSize, sym.decimals);
      sym.ask = roundToTick(last.close + baseSpread / 2, sym.tickSize, sym.decimals);
      sym.spread = Math.max(sym.tickSize, Number((sym.ask - sym.bid).toFixed(sym.decimals)));
      if (sym.dayOpen <= 0) sym.dayOpen = candles[0].open;
      if (sym.dayHigh <= 0) sym.dayHigh = last.high;
      if (sym.dayLow <= 0) sym.dayLow = last.low;
      sym.dataSource = 'lse-rest';
    }

    return {
      symbol: sym.symbol,
      market,
      httpSymbol,
      timeframe: params.timeframe,
      candles,
      source,
      from,
      to,
    };
  }

  /**
   * Serialized raw CSV export for the LSE Exporter panel & Watchlist CSV download.
   */
  public async exportRawCsv(params: {
    market: string;
    symbol: string;
    timeframe: string;
    from: string;
    to: string;
    adjusted?: boolean;
  }): Promise<string> {
    const qs = new URLSearchParams({
      market: params.market,
      symbol: params.symbol,
      timeframe: params.timeframe,
      from: params.from,
      to: params.to,
      adjusted: params.adjusted === false ? '0' : '1',
      format: 'csv',
    });
    const res = await this.runSerializedExport(() => this.fetchText(`/v3/export?${qs.toString()}`));
    if (res.status >= 400) {
      throw new Error(`LSE export failed (${res.status}): ${res.text.slice(0, 180)}`);
    }
    return res.text;
  }

  /**
   * Fetches US Options Chain with Greeks & IV from LSE Vault (/vault/options/chain).
   */
  public async getOptionsChain(params: {
    underlying: string;
    contractType?: string;
    expiry?: string;
    limit?: number;
  }): Promise<{
    underlying: string;
    underlyingPrice: number;
    expiries: string[];
    contracts: OptionChainContract[];
  }> {
    const underlying = String(params.underlying || 'AAPL').trim().toUpperCase();
    const limit = Math.min(1000, Math.max(20, Number(params.limit) || 250));
    const qs = new URLSearchParams({
      underlying,
      limit: String(limit),
    });
    if (params.contractType === 'call' || params.contractType === 'put') {
      qs.set('contract_type', params.contractType);
    }
    if (params.expiry) {
      qs.set('expiry', params.expiry);
    }

    const cacheKey = `optchain:${qs.toString()}`;
    const cached = this.getCached<{
      underlying: string;
      underlyingPrice: number;
      expiries: string[];
      contracts: OptionChainContract[];
    }>(cacheKey);
    if (cached) return cached;

    const existingFlight = this.inFlight.get(cacheKey) as
      | Promise<{
          underlying: string;
          underlyingPrice: number;
          expiries: string[];
          contracts: OptionChainContract[];
        }>
      | undefined;
    if (existingFlight) return existingFlight;

    const task = (async () => {
      const res = await this.runVaultQueued(() =>
        this.fetchVaultText(`/vault/options/chain?${qs.toString()}`)
      );
      if (res.status >= 400) {
        throw new Error(`LSE options chain error (${res.status}): ${res.text.slice(0, 180)}`);
      }
      const rawRows = JSON.parse(res.text);
      const list = Array.isArray(rawRows) ? rawRows : [];
      const sessionEt = getActiveOptionsSessionDateEt();
      const contracts: OptionChainContract[] = list
        .map((r: Record<string, unknown>) => {
          const expStr = String(r.expiry || '');
          const liveDte = expStr ? computeLiveDte(expStr, sessionEt) : Number(r.dte) || 0;
          return {
            ticker: String(r.ticker || ''),
            occSymbol: normalizeOccSymbol(String(r.ticker || '')),
            underlying: String(r.underlying || underlying),
            strike: Number(r.strike) || 0,
            expiry: expStr,
            contract_type: (r.contract_type === 'put' ? 'put' : 'call') as 'call' | 'put',
            last_price: Number(r.last_price) || 0,
            volume_today: Number(r.volume_today) || 0,
            premium_today: Number(r.premium_today) || 0,
            underlying_price: Number(r.underlying_price) || 0,
            dte: liveDte,
            iv: r.iv !== null && r.iv !== undefined ? Number(r.iv) : null,
            delta: r.delta !== null && r.delta !== undefined ? Number(r.delta) : null,
            gamma: r.gamma !== null && r.gamma !== undefined ? Number(r.gamma) : null,
            theta: r.theta !== null && r.theta !== undefined ? Number(r.theta) : null,
            vega: r.vega !== null && r.vega !== undefined ? Number(r.vega) : null,
            rho: r.rho !== null && r.rho !== undefined ? Number(r.rho) : null,
            last_trade_at: r.last_trade_at ? String(r.last_trade_at) : null,
            updated_at: r.updated_at ? String(r.updated_at) : null,
          };
        })
        .sort((a, b) => a.expiry.localeCompare(b.expiry) || a.strike - b.strike);

      let expiries = Array.from(new Set(contracts.map((c) => c.expiry).filter(Boolean))).sort();
      if (!params.expiry && contracts.length > 0) {
        const cachedDiscovered = this.getCached<string[]>(`optexp:${sessionEt}:${underlying}`);
        if (cachedDiscovered && cachedDiscovered.length > 0) {
          expiries = Array.from(new Set([...expiries, ...cachedDiscovered]))
            .filter((exp) => exp >= sessionEt)
            .sort();
        } else if (contracts.length >= limit - 5) {
          try {
            const discovered = await this.discoverActiveExpiries(
              underlying,
              sessionEt,
              contracts,
              [],
              true
            );
            if (discovered.length > 0) {
              expiries = discovered;
            }
          } catch {
            // Keep expiries from initial payload if discovery probe fails
          }
        }
      }
      const underlyingPrice =
        contracts.find((c) => c.underlying_price > 0)?.underlying_price ?? 0;

      const payload = {
        underlying,
        underlyingPrice,
        expiries,
        contracts,
      };
      this.setCached(cacheKey, payload, 15_000);
      return payload;
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  /**
   * Discovers active OPRA option expiries for an underlying across 0DTE, next 1W (5 trading days),
   * and upcoming Monthly OpEx (3rd Friday) cycles, overcoming per-query row caps on dense tickers like SPY/QQQ.
   */
  private async discoverActiveExpiries(
    underlying: string,
    sessionEt: string,
    seedContracts: OptionChainContract[] = [],
    flowPrints: OptionFlowPrint[] = [],
    forceFullProbe: boolean = false
  ): Promise<string[]> {
    const expCacheKey = `optexp:${sessionEt}:${underlying}`;
    const cached = this.getCached<string[]>(expCacheKey);
    if (cached && cached.length > 0) return cached;

    const existingFlight = this.inFlight.get(expCacheKey) as Promise<string[]> | undefined;
    if (existingFlight) return existingFlight;

    const task = (async () => {
      const todayEt = getEtDateString();
      const seenExpiries = new Set<string>();
      for (const c of seedContracts) {
        if (c.expiry) seenExpiries.add(c.expiry);
      }
      for (const p of flowPrints) {
        if (p.expiry) seenExpiries.add(p.expiry);
      }

      // Build target weekly (0..6 trading days + next Friday) and Monthly OpEx (next 3 3rd-Fridays) candidates
      const candidates = new Set<string>();
      for (let td = 0; td <= 7; td++) {
        candidates.add(addTradingDaysEt(sessionEt, td));
      }
      const nextWeekFriBase = Date.parse(`${addTradingDaysEt(sessionEt, 5)}T12:00:00Z`);
      if (Number.isFinite(nextWeekFriBase)) {
        const dow = new Date(nextWeekFriBase).getUTCDay();
        const toFri = (5 - dow + 7) % 7;
        candidates.add(new Date(nextWeekFriBase + toFri * 86_400_000).toISOString().slice(0, 10));
      }
      for (const opex of getMonthlyOpExCandidates(sessionEt, 3)) {
        candidates.add(opex);
      }

      // Only probe dates not already seen in seedContracts when the overview payload looks truncated (or empty)
      const shouldProbeAll = forceFullProbe || seedContracts.length === 0 || seedContracts.length >= 900;
      const toProbe = shouldProbeAll
        ? Array.from(candidates).filter((d) => !seenExpiries.has(d))
        : getMonthlyOpExCandidates(sessionEt, 2).filter((d) => !seenExpiries.has(d));

      if (toProbe.length > 0) {
        const probeRes = await Promise.all(
          toProbe.map((dStr) =>
            this.getOptionsChain({ underlying, expiry: dStr, limit: 20 }).catch(() => null)
          )
        );
        for (const r of probeRes) {
          if (r && r.contracts.length > 0) {
            for (const c of r.contracts) {
              if (c.expiry) seenExpiries.add(c.expiry);
            }
          }
        }
      }

      const sorted = Array.from(seenExpiries).sort();
      const activeFromSession = sorted.filter((d) => d >= sessionEt);
      const activeFromToday = sorted.filter((d) => d >= todayEt);
      const finalList =
        activeFromSession.length > 0
          ? activeFromSession
          : activeFromToday.length > 0
          ? activeFromToday
          : sorted;

      this.setCached(expCacheKey, finalList, 90_000);
      return finalList;
    })().finally(() => {
      this.inFlight.delete(expCacheKey);
    });

    this.inFlight.set(expCacheKey, task);
    return task;
  }

  /**
   * Fetches US Options Flow prints (/vault/options/flow).
   */
  public async getOptionsFlow(params: {
    underlying?: string;
    minPremium?: number;
    limit?: number;
  }): Promise<{ prints: OptionFlowPrint[] }> {
    const limit = Math.min(500, Math.max(10, Number(params.limit) || 60));
    const qs = new URLSearchParams({ limit: String(limit) });
    if (params.underlying && params.underlying.trim()) {
      qs.set('underlying', params.underlying.trim().toUpperCase());
    }
    if (params.minPremium && Number(params.minPremium) > 0) {
      qs.set('min_premium', String(Math.floor(Number(params.minPremium))));
    }

    const cacheKey = `optflow:${qs.toString()}`;
    const cached = this.getCached<{ prints: OptionFlowPrint[] }>(cacheKey);
    if (cached) return cached;

    const existingFlight = this.inFlight.get(cacheKey) as Promise<{ prints: OptionFlowPrint[] }> | undefined;
    if (existingFlight) return existingFlight;

    const task = (async () => {
      const res = await this.runVaultQueued(() =>
        this.fetchVaultText(`/vault/options/flow?${qs.toString()}`)
      );
      if (res.status >= 400) {
        throw new Error(`LSE options flow error (${res.status}): ${res.text.slice(0, 180)}`);
      }
      const rawRows = JSON.parse(res.text);
      const list = Array.isArray(rawRows) ? rawRows : [];
      const sessionEt = getActiveOptionsSessionDateEt();
      const prints: OptionFlowPrint[] = list.map((r: Record<string, unknown>) => {
        const expStr = String(r.expiry || '');
        const liveDte = expStr ? computeLiveDte(expStr, sessionEt) : Number(r.dte) || 0;
        return {
          id: String(r.id || `${r.ticker}-${r.ts}`),
          ts: String(r.ts || ''),
          underlying: String(r.underlying || ''),
          ticker: String(r.ticker || ''),
          occSymbol: normalizeOccSymbol(String(r.ticker || '')),
          strike: Number(r.strike) || 0,
          expiry: expStr,
          contract_type: (r.contract_type === 'put' ? 'put' : 'call') as 'call' | 'put',
          last_price: Number(r.last_price) || 0,
          volume: Number(r.volume) || 0,
          premium: Number(r.premium) || 0,
          underlying_price: Number(r.underlying_price) || 0,
          dte: liveDte,
          iv: r.iv !== null && r.iv !== undefined ? Number(r.iv) : null,
          delta: r.delta !== null && r.delta !== undefined ? Number(r.delta) : null,
          gamma: r.gamma !== null && r.gamma !== undefined ? Number(r.gamma) : null,
          theta: r.theta !== null && r.theta !== undefined ? Number(r.theta) : null,
          vega: r.vega !== null && r.vega !== undefined ? Number(r.vega) : null,
          rho: r.rho !== null && r.rho !== undefined ? Number(r.rho) : null,
        };
      });
      const payload = { prints };
      this.setCached(cacheKey, payload, 10_000);
      return payload;
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  /**
   * Computes Gamma Exposure (GEX) levels, Flip Profile, and Options Orderflow charts
   * across 0DTE, Next 1W (5 trading days), 0-5D Weekly Strip, Monthly OpEx, or All Expiries
   * strictly from live LSE /vault/options/chain & /vault/options/flow endpoints.
   */
  public async getOptionsGexDashboard(params: {
    underlying: string;
    expiry?: string;
    horizon?: GexHorizonMode;
    flowScope?: '0dte' | 'all';
  }): Promise<GexDashboardData> {
    const underlying = String(params.underlying || 'SPY').trim().toUpperCase();
    const reqExpiry = params.expiry ? String(params.expiry).trim() : '';
    const reqHorizonRaw = params.horizon ? String(params.horizon).trim().toLowerCase() : '';
    const flowScope: '0dte' | 'all' = params.flowScope === 'all' ? 'all' : '0dte';
    const sessionEt = getActiveOptionsSessionDateEt();

    const effectiveHorizon: GexHorizonMode =
      reqHorizonRaw && reqHorizonRaw !== 'custom'
        ? reqHorizonRaw
        : reqExpiry
        ? 'custom'
        : '0dte';

    const cacheKey = `optgex:${sessionEt}:${underlying}:${effectiveHorizon}:${reqExpiry || 'auto'}:${flowScope}`;
    const cached = this.getCached<GexDashboardData>(cacheKey);
    if (cached) return cached;

    const existingFlight = this.inFlight.get(cacheKey) as Promise<GexDashboardData> | undefined;
    if (existingFlight) return existingFlight;

    const task = (async () => {
      const [overviewChain, flowRes] = await Promise.all([
        this.getOptionsChain({ underlying, limit: 1000 }),
        this.getOptionsFlow({ underlying, limit: 500 }),
      ]);

      const discoveredDates = await this.discoverActiveExpiries(
        underlying,
        sessionEt,
        overviewChain.contracts,
        flowRes.prints
      );

      const monthlySet = new Set(getMonthlyOpExCandidates(sessionEt, 4));
      const oneWeekCutoffDate = addTradingDaysEt(sessionEt, 5);

      const baseExpiries = discoveredDates.map((expiry) => ({
        expiry,
        dte: computeLiveDte(expiry, sessionEt),
        tradingDte: computeTradingDaysBetween(sessionEt, expiry),
      }));

      // Identify semantic horizon targets
      const zeroDteItem = baseExpiries[0];
      const oneWeekCandidates = baseExpiries.filter((e) => e.tradingDte >= 3);
      const oneWeekItem =
        oneWeekCandidates.length > 0
          ? oneWeekCandidates.reduce((best, cur) =>
              Math.abs(cur.tradingDte - 5) < Math.abs(best.tradingDte - 5) ? cur : best
            )
          : baseExpiries[baseExpiries.length - 1];

      const within5Td = baseExpiries.filter((e) => e.tradingDte <= 5);
      const weeklyStripItems =
        within5Td.length >= 2
          ? within5Td
          : baseExpiries.filter((e) => e.expiry <= (oneWeekItem?.expiry || oneWeekCutoffDate));

      const monthlyItem =
        baseExpiries.find((e) => monthlySet.has(e.expiry) && e.dte >= 5) ||
        baseExpiries.find((e) => monthlySet.has(e.expiry) && e.dte >= 0) ||
        baseExpiries[baseExpiries.length - 1];

      const nextMonthlyItem =
        (monthlyItem &&
          baseExpiries.find(
            (e) => monthlySet.has(e.expiry) && e.expiry > monthlyItem.expiry
          )) ||
        monthlyItem;

      const expiries: Array<{ expiry: string; dte: number; tag?: string }> = baseExpiries.map((e) => {
        let tag: string | undefined;
        if (zeroDteItem && e.expiry === zeroDteItem.expiry) {
          tag = e.dte === 0 ? '0DTE' : 'Nearest';
        } else if (
          oneWeekItem &&
          e.expiry === oneWeekItem.expiry &&
          monthlyItem &&
          e.expiry === monthlyItem.expiry
        ) {
          tag = '1W · Monthly';
        } else if (oneWeekItem && e.expiry === oneWeekItem.expiry) {
          tag = '1W (5D)';
        } else if (monthlyItem && e.expiry === monthlyItem.expiry) {
          tag = 'Monthly OpEx';
        } else if (monthlySet.has(e.expiry)) {
          tag = 'OpEx';
        } else if (e.tradingDte <= 5) {
          tag = 'Weekly';
        }
        return { expiry: e.expiry, dte: e.dte, tag };
      });

      const validExpirySet = new Set(expiries.map((e) => e.expiry));

      // Group contracts by expiry from overviewChain as seed cache
      const contractsByExpiry = new Map<string, OptionChainContract[]>();
      for (const c of overviewChain.contracts) {
        if (!c.expiry) continue;
        const arr = contractsByExpiry.get(c.expiry) || [];
        arr.push(c);
        contractsByExpiry.set(c.expiry, arr);
      }

      const fetchFullExpiry = async (exp: string, lim: number = 1000): Promise<OptionChainContract[]> => {
        if (!exp) return [];
        const existing = contractsByExpiry.get(exp);
        if (existing && existing.length > 0 && overviewChain.contracts.length < 950) {
          return existing;
        }
        try {
          const exact = await this.getOptionsChain({ underlying, expiry: exp, limit: lim });
          if (exact.contracts.length > 0) {
            contractsByExpiry.set(exp, exact.contracts);
            return exact.contracts;
          }
        } catch {
          // fallback to existing overview slice if exact query fails
        }
        return existing || [];
      };

      // Always fetch anchor horizons so term-structure comparison strip has live numbers
      const coreDatesToFetch = Array.from(
        new Set(
          [
            zeroDteItem?.expiry,
            oneWeekItem?.expiry,
            monthlyItem?.expiry,
            effectiveHorizon === 'next_monthly' ? nextMonthlyItem?.expiry : undefined,
            reqExpiry && validExpirySet.has(reqExpiry) ? reqExpiry : undefined,
          ].filter((x): x is string => Boolean(x))
        )
      );

      // Include intermediate weekly strip expiries so 0-5D summary & strip mode are exact
      const stripDatesToFetch = weeklyStripItems
        .map((e) => e.expiry)
        .filter((d) => !coreDatesToFetch.includes(d));

      await Promise.all([
        ...coreDatesToFetch.map((d) => fetchFullExpiry(d, 1000)),
        ...stripDatesToFetch.map((d) => fetchFullExpiry(d, 600)),
      ]);

      // Determine active target expiry, contracts, DTE, and display label for requested horizon
      let selectedExpiry = zeroDteItem?.expiry || reqExpiry || '';
      let selectedDte = selectedExpiry ? computeLiveDte(selectedExpiry, sessionEt) : 0;
      let targetContracts: OptionChainContract[] = [];
      let matchingExpiriesForFlow: string[] | undefined;
      let expiryRangeLabel = selectedExpiry;

      if (effectiveHorizon === '1w' && oneWeekItem) {
        selectedExpiry = oneWeekItem.expiry;
        selectedDte = oneWeekItem.dte;
        targetContracts = contractsByExpiry.get(selectedExpiry) || [];
        expiryRangeLabel = `Next 1W (${oneWeekItem.tradingDte}TD · ${selectedExpiry.slice(5)})`;
      } else if (effectiveHorizon === 'weekly_strip' && weeklyStripItems.length > 0) {
        const stripExps = weeklyStripItems.map((e) => e.expiry);
        selectedExpiry = stripExps[stripExps.length - 1];
        selectedDte = computeLiveDte(selectedExpiry, sessionEt);
        targetContracts = stripExps.flatMap((d) => contractsByExpiry.get(d) || []);
        matchingExpiriesForFlow = stripExps;
        const firstShort = stripExps[0].slice(5);
        const lastShort = stripExps[stripExps.length - 1].slice(5);
        expiryRangeLabel =
          stripExps.length > 1
            ? `Weekly Strip 0–5D (${firstShort} → ${lastShort})`
            : `Weekly (${selectedExpiry.slice(5)})`;
      } else if (effectiveHorizon === 'monthly' && monthlyItem) {
        selectedExpiry = monthlyItem.expiry;
        selectedDte = monthlyItem.dte;
        targetContracts = contractsByExpiry.get(selectedExpiry) || [];
        expiryRangeLabel = `Monthly OpEx (${selectedExpiry.slice(5)} · ${selectedDte}DTE)`;
      } else if (effectiveHorizon === 'next_monthly' && nextMonthlyItem) {
        selectedExpiry = nextMonthlyItem.expiry;
        selectedDte = nextMonthlyItem.dte;
        targetContracts = contractsByExpiry.get(selectedExpiry) || [];
        expiryRangeLabel = `Next Monthly (${selectedExpiry.slice(5)} · ${selectedDte}DTE)`;
      } else if (effectiveHorizon === 'all') {
        const allKeyDates = Array.from(
          new Set([
            ...weeklyStripItems.map((e) => e.expiry),
            monthlyItem?.expiry || '',
            nextMonthlyItem?.expiry || '',
          ].filter(Boolean))
        ).sort();
        if (effectiveHorizon === 'all' && nextMonthlyItem?.expiry && !contractsByExpiry.has(nextMonthlyItem.expiry)) {
          await fetchFullExpiry(nextMonthlyItem.expiry, 600);
        }
        selectedExpiry = zeroDteItem?.expiry || allKeyDates[0] || '';
        selectedDte = selectedExpiry ? computeLiveDte(selectedExpiry, sessionEt) : 0;
        targetContracts = allKeyDates.flatMap((d) => contractsByExpiry.get(d) || []);
        matchingExpiriesForFlow = allKeyDates;
        expiryRangeLabel = `All Key Expiries (${allKeyDates.length} exp)`;
      } else if (reqExpiry && validExpirySet.has(reqExpiry)) {
        selectedExpiry = reqExpiry;
        selectedDte = computeLiveDte(selectedExpiry, sessionEt);
        targetContracts = contractsByExpiry.get(selectedExpiry) || [];
        expiryRangeLabel = `${selectedExpiry} (${selectedDte === 0 ? '0DTE' : `${selectedDte}DTE`})`;
      } else {
        selectedExpiry = zeroDteItem?.expiry || '';
        selectedDte = selectedExpiry ? computeLiveDte(selectedExpiry, sessionEt) : 0;
        targetContracts = contractsByExpiry.get(selectedExpiry) || [];
        expiryRangeLabel = selectedExpiry
          ? `${selectedDte === 0 ? '0DTE' : `${selectedDte}DTE`} (${selectedExpiry.slice(5)})`
          : 'Nearest Expiry';
      }

      const fallbackSpot =
        targetContracts.find((c) => c.underlying_price > 0)?.underlying_price ||
        overviewChain.underlyingPrice ||
        this.getSymbol(underlying)?.price ||
        0;

      // Build term-structure horizon comparison summaries (0DTE, 1W 5D, 0-5D Strip, Monthly OpEx)
      const horizonSummaries: GexHorizonSummary[] = [];
      const makeSummary = (
        mode: GexHorizonSummary['mode'],
        label: string,
        exp: string,
        dteVal: number,
        cts: OptionChainContract[]
      ) => {
        if (!cts.length || !exp) return;
        const dash = buildGexDashboardData({
          underlying,
          selectedExpiry: exp,
          selectedDte: dteVal,
          expiries,
          chainContracts: cts,
          flowPrints: [],
          flowScope: 'all',
          fallbackSpot,
          sessionDateEt: sessionEt,
          horizonUsed: mode,
        });
        horizonSummaries.push({
          mode,
          label,
          expiry: exp,
          dte: dteVal,
          callWall: dash.metrics.callWall,
          putWall: dash.metrics.putWall,
          zeroGammaFlip: dash.metrics.zeroGammaFlip,
          totalNetGexM: dash.metrics.totalNetGexM,
          expectedMove: dash.metrics.expectedMove1D,
        });
      };

      if (zeroDteItem) {
        makeSummary(
          '0dte',
          zeroDteItem.dte === 0 ? `0DTE (${zeroDteItem.expiry.slice(5)})` : `Nearest (${zeroDteItem.expiry.slice(5)})`,
          zeroDteItem.expiry,
          zeroDteItem.dte,
          contractsByExpiry.get(zeroDteItem.expiry) || []
        );
      }
      if (oneWeekItem && oneWeekItem.expiry !== zeroDteItem?.expiry) {
        makeSummary(
          '1w',
          `Next 1W (${oneWeekItem.expiry.slice(5)})`,
          oneWeekItem.expiry,
          oneWeekItem.dte,
          contractsByExpiry.get(oneWeekItem.expiry) || []
        );
      }
      if (weeklyStripItems.length >= 2) {
        const stripExps = weeklyStripItems.map((e) => e.expiry);
        const stripCts = stripExps.flatMap((d) => contractsByExpiry.get(d) || []);
        const lastStrip = weeklyStripItems[weeklyStripItems.length - 1];
        makeSummary(
          'weekly_strip',
          `0–5D Weekly (${stripExps.length}d)`,
          lastStrip.expiry,
          lastStrip.dte,
          stripCts
        );
      }
      if (monthlyItem && monthlyItem.expiry !== zeroDteItem?.expiry) {
        makeSummary(
          'monthly',
          `Monthly OpEx (${monthlyItem.expiry.slice(5)})`,
          monthlyItem.expiry,
          monthlyItem.dte,
          contractsByExpiry.get(monthlyItem.expiry) || []
        );
      }

      const dashboard = buildGexDashboardData({
        underlying,
        selectedExpiry,
        selectedDte,
        expiries,
        chainContracts: targetContracts,
        flowPrints: flowRes.prints,
        flowScope,
        fallbackSpot,
        sessionDateEt: sessionEt,
        horizonUsed: effectiveHorizon,
        expiryRangeLabel,
        horizonSummaries,
        matchingExpiriesForFlow,
      });

      this.setCached(cacheKey, dashboard, 15_000);
      return dashboard;
    })().finally(() => {
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, task);
    return task;
  }

  /**
   * Registers a searched LSE pair, hydrates its latest daily quote via /v3/preview,
   * and ensures it is subscribed on the live WebSocket bridge.
   */
  public async subscribeAndHydrate(market: string, pairSymbol: string, pairName: string): Promise<SymbolInfo> {
    const sym = this.mapPairToSymbolInfo(market, pairSymbol, pairName);
    if (this.apiKey) {
      try {
        const preview = await this.fetchJson<{
          rows?: Array<{ time: string; open: number; high: number; low: number; close: number; volume?: number }>;
        }>(
          `/v3/preview?market=${encodeURIComponent(sym.lseMarket)}&symbol=${encodeURIComponent(
            sym.lseHttpSymbol
          )}&timeframe=1d`,
          60_000
        );
        const rows = preview.rows || [];
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          const prev = rows.length >= 2 ? rows[rows.length - 2] : last;
          const refOpen = Number(prev.close) || Number(last.open);
          const price = Number(last.close);
          const decimals = price < 5 ? 5 : price < 50 ? 2 : sym.decimals;
          const tickSize = decimals >= 5 ? 0.00001 : 0.01;
          const change = Number((price - refOpen).toFixed(decimals));
          const changePercent = refOpen > 0 ? Number(((change / refOpen) * 100).toFixed(2)) : 0;
          const spread = tickSize * 2;
          const updated: SymbolInfo = {
            ...sym,
            price,
            decimals,
            tickSize,
            spread,
            change,
            changePercent,
            bid: roundToTick(price - spread / 2, tickSize, decimals),
            ask: roundToTick(price + spread / 2, tickSize, decimals),
            dayHigh: Number(last.high) || price,
            dayLow: Number(last.low) || price,
            dayOpen: refOpen,
            volume24h: Number(last.volume) || sym.volume24h,
            lastTickTs: last.time,
            dataSource: 'lse-rest',
          };
          this.registerSymbol(updated);
          this.ensureSubscribed(updated);
          return updated;
        }
      } catch {
        // Return mapped symbol even if preview is momentarily unavailable
      }
    }
    this.ensureSubscribed(sym);
    return sym;
  }

  /**
   * Starts persistent WebSocket connections to data-ws & london-ws,
   * authenticates with LSE_API_KEY, and subscribes up to 16 symbols.
   */
  public startWebSockets(onTick: (sym: SymbolInfo, rawTick: LseTickPayload) => void) {
    this.onTickCallback = onTick;
    if (!this.apiKey) return;
    if (this.wsActive && (this.dataWs || this.londonWs)) return;

    this.intentionalStop = false;
    this.wsActive = true;
    this.lastWsError = null;
    this.desiredDataWs = [];
    this.desiredLondonWs = [];
    for (const sym of this.symbols.values()) {
      if (!sym.lseWsSymbol) continue;
      if (sym.lseWsEndpoint === 'london-ws') {
        this.desiredLondonWs.push(sym.lseWsSymbol);
      } else if (sym.lseWsEndpoint === 'data-ws') {
        this.desiredDataWs.push(sym.lseWsSymbol);
      }
    }

    void this.connectUpstreamSocket('data-ws');
    void this.connectUpstreamSocket('london-ws');

    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => {
      if (this.dataWs && this.dataWs.readyState === WS_OPEN) {
        this.dataWs.send(JSON.stringify({ action: 'ping' }));
      }
      if (this.londonWs && this.londonWs.readyState === WS_OPEN) {
        this.londonWs.send(JSON.stringify({ action: 'ping' }));
      }
    }, 24_000);
  }

  public stopWebSockets() {
    this.intentionalStop = true;
    this.wsActive = false;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    for (const t of this.reconnectTimers) clearTimeout(t);
    this.reconnectTimers = [];
    try {
      this.dataWs?.close();
    } catch {
      // ignore
    }
    try {
      this.londonWs?.close();
    } catch {
      // ignore
    }
    this.dataWs = null;
    this.londonWs = null;
    this.dataWsState = 'disconnected';
    this.londonWsState = 'disconnected';
    this.subscribedDataWs.clear();
    this.subscribedLondonWs.clear();
  }

  public reconnectWebSockets() {
    const cb = this.onTickCallback;
    this.stopWebSockets();
    if (cb) {
      this.startWebSockets(cb);
    }
  }

  /**
   * Real LSE Vault live quote poller used automatically when upstream LSE WebSockets are
   * unavailable (Cloudflare Workers cannot hold the persistent sockets). Reads 1-second
   * candles so prices trail upstream by roughly one second instead of one minute.
   */
  public async pollLiveQuotesFallback(
    prioritySymbols: string[] = []
  ): Promise<Array<{ sym: SymbolInfo; rawTick: LseTickPayload }>> {
    if (!this.apiKey || this.isPaused) return [];
    const now = Date.now();

    const requested: SymbolInfo[] = [];
    const seen = new Set<string>();
    for (const key of prioritySymbols) {
      const s = this.getSymbol(key);
      if (s && !seen.has(s.symbol)) {
        seen.add(s.symbol);
        requested.push(s);
      }
    }
    if (requested.length === 0) {
      for (const key of ['NASDAQ100', 'BTCUSDT']) {
        const s = this.getSymbol(key);
        if (s && !seen.has(s.symbol)) {
          seen.add(s.symbol);
          requested.push(s);
        }
      }
    }
    if (requested.length === 0) return [];

    // Only the symbols the browser is actually showing are refreshed, least-recently-polled first,
    // at most one per call. That keeps upstream REST usage at ~60 calls/min in total, no matter
    // how many browser tabs are polling, while still refreshing every visible symbol in turn.
    const batch: SymbolInfo[] = requested
      .map((s) => ({ s, at: this.livePollAtBySymbol.get(s.symbol) ?? 0 }))
      .sort((a, b) => a.at - b.at)
      .filter((x) => now - x.at >= LIVE_POLL_MIN_INTERVAL_MS)
      .slice(0, 1)
      .map((x) => x.s);
    if (batch.length === 0) return [];

    const endIso = new Date(now + 60_000).toISOString().slice(0, 19) + 'Z';
    const startIso = new Date(now - 90_000).toISOString().slice(0, 19) + 'Z';
    const emitted: Array<{ sym: SymbolInfo; rawTick: LseTickPayload }> = [];

    for (const sym of batch) {
      this.livePollAtBySymbol.set(sym.symbol, now);
      try {
        // 1-second vault candles put the served price at most ~1s behind upstream; the 1m
        // candles used before carried up to a full minute of staleness. Fall back if 1s is absent.
        let bars = await this.fetchVaultCandles(sym, '1s', startIso, endIso, 120, 800);
        let barSeconds = 1;
        if (bars.length === 0) {
          bars = await this.fetchVaultCandles(sym, '1m', startIso, endIso, 40, 800);
          barSeconds = 60;
        }
        const lastBar = bars[bars.length - 1];
        if (!lastBar || !Number.isFinite(lastBar.close) || lastBar.close <= 0) continue;

        const price = lastBar.close;
        const current = this.symbols.get(sym.symbol) || sym;
        const defaultSpread =
          INITIAL_SYMBOLS.find((s) => s.symbol === sym.symbol)?.spread ?? current.tickSize * 2;
        const halfSpread = Math.max(current.tickSize, defaultSpread / 2);
        const bid = roundToTick(price - halfSpread, current.tickSize, current.decimals);
        const ask = roundToTick(price + halfSpread, current.tickSize, current.decimals);
        const spread = Math.max(current.tickSize, Number((ask - bid).toFixed(current.decimals)));
        const effectiveDayOpen = current.dayOpen > 0 ? current.dayOpen : lastBar.open || price;
        const change = Number((price - effectiveDayOpen).toFixed(current.decimals));
        const changePercent =
          effectiveDayOpen > 0 ? Number(((change / effectiveDayOpen) * 100).toFixed(2)) : 0;
        const tickIso = new Date(lastBar.time * 1000).toISOString();

        const prevBars = this.liveBars1m.get(sym.symbol) || [];
        const nextBars = mergeTickIntoCandles(prevBars, price, lastBar.time, 0, 60);
        this.liveBars1m.set(sym.symbol, nextBars.length > 1440 ? nextBars.slice(-1440) : nextBars);
        if (barSeconds === 1) {
          const prevSec = this.liveBars1s.get(sym.symbol) || [];
          const nextSec = mergeTickIntoCandles(prevSec, price, lastBar.time, 0, 1);
          this.liveBars1s.set(sym.symbol, nextSec.length > 1800 ? nextSec.slice(-1800) : nextSec);
        }

        const updated: SymbolInfo = {
          ...current,
          price,
          bid,
          ask,
          spread,
          dayOpen: effectiveDayOpen,
          change,
          changePercent,
          dayHigh: current.dayHigh > 0 ? Math.max(current.dayHigh, lastBar.high || price) : lastBar.high || price,
          dayLow: current.dayLow > 0 ? Math.min(current.dayLow, lastBar.low || price) : lastBar.low || price,
          lastTickTs: tickIso,
          dataSource: 'lse-rest',
        };
        this.symbols.set(sym.symbol, updated);
        this.lastTickAt = Date.now();

        const rawTick: LseTickPayload = {
          symbol: sym.symbol,
          price,
          bid,
          ask,
          volume: lastBar.volume || 0,
          ts: tickIso,
          sourceSocket: sym.lseWsEndpoint === 'london-ws' ? 'london-ws' : 'data-ws',
        };
        emitted.push({ sym: updated, rawTick });
        this.onTickCallback?.(updated, rawTick);
      } catch {
        // Ignore individual fallback poll error; try next symbol
      }
    }

    return emitted;
  }

  /**
   * Ensures a symbol is subscribed on the appropriate LSE WebSocket while respecting the 16-slot limit.
   */
  public ensureSubscribed(sym: SymbolInfo) {
    if (!sym.lseWsSymbol || !this.apiKey) return;
    if (sym.lseWsEndpoint === 'london-ws') {
      if (this.subscribedLondonWs.has(sym.lseWsSymbol)) return;
      if (this.subscribedDataWs.size + this.subscribedLondonWs.size >= this.maxSubscriptions) {
        this.evictOldestSubscription();
      }
      if (!this.desiredLondonWs.includes(sym.lseWsSymbol)) {
        this.desiredLondonWs.push(sym.lseWsSymbol);
      }
      if (this.londonWs && this.londonWs.readyState === WS_OPEN && this.londonWsState === 'authenticated') {
        this.londonWs.send(JSON.stringify({ action: 'subscribe', symbol: sym.lseWsSymbol }));
      }
    } else if (sym.lseWsEndpoint === 'data-ws') {
      if (this.subscribedDataWs.has(sym.lseWsSymbol)) return;
      if (this.subscribedDataWs.size + this.subscribedLondonWs.size >= this.maxSubscriptions) {
        this.evictOldestSubscription();
      }
      if (!this.desiredDataWs.includes(sym.lseWsSymbol)) {
        this.desiredDataWs.push(sym.lseWsSymbol);
      }
      if (this.dataWs && this.dataWs.readyState === WS_OPEN && this.dataWsState === 'authenticated') {
        this.dataWs.send(JSON.stringify({ action: 'subscribe', symbol: sym.lseWsSymbol }));
      }
    }
  }

  private evictOldestSubscription() {
    // Evict from data-ws first if > 0 non-core slots, keeping defaults intact when possible
    const candidate = Array.from(this.subscribedDataWs).pop() || Array.from(this.subscribedLondonWs).pop();
    if (!candidate) return;
    if (this.subscribedDataWs.has(candidate)) {
      this.subscribedDataWs.delete(candidate);
      if (this.dataWs && this.dataWs.readyState === WS_OPEN) {
        this.dataWs.send(JSON.stringify({ action: 'unsubscribe', symbol: candidate }));
      }
    } else if (this.subscribedLondonWs.has(candidate)) {
      this.subscribedLondonWs.delete(candidate);
      if (this.londonWs && this.londonWs.readyState === WS_OPEN) {
        this.londonWs.send(JSON.stringify({ action: 'unsubscribe', symbol: candidate }));
      }
    }
  }

  private async connectUpstreamSocket(endpoint: 'data-ws' | 'london-ws') {
    const url = endpoint === 'london-ws' ? LSE_LONDON_WS_URL : LSE_DATA_WS_URL;
    if (endpoint === 'data-ws') {
      this.dataWsState = 'connecting';
      this.subscribedDataWs.clear();
    } else {
      this.londonWsState = 'connecting';
      this.subscribedLondonWs.clear();
    }

    const Ctor = await loadWsCtor();
    if (!Ctor) {
      if (endpoint === 'data-ws') this.dataWsState = 'error';
      else this.londonWsState = 'error';
      this.lastWsError = 'WebSocket transport unavailable in this runtime; using HTTP polling.';
      return;
    }
    const ws = new Ctor(url);
    if (endpoint === 'data-ws') this.dataWs = ws;
    else this.londonWs = ws;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'welcome') {
          ws.send(JSON.stringify({ action: 'auth', api_key: this.apiKey }));
        } else if (msg.type === 'authenticated') {
          if (typeof msg.max_subscriptions === 'number') {
            this.maxSubscriptions = msg.max_subscriptions;
          }
          if (endpoint === 'data-ws') {
            this.dataWsState = 'authenticated';
            for (const sym of this.desiredDataWs) {
              if (this.subscribedDataWs.size + this.subscribedLondonWs.size < this.maxSubscriptions) {
                ws.send(JSON.stringify({ action: 'subscribe', symbol: sym }));
              }
            }
          } else {
            this.londonWsState = 'authenticated';
            for (const sym of this.desiredLondonWs) {
              if (this.subscribedDataWs.size + this.subscribedLondonWs.size < this.maxSubscriptions) {
                ws.send(JSON.stringify({ action: 'subscribe', symbol: sym }));
              }
            }
          }
        } else if (msg.type === 'subscribed' && msg.symbol) {
          if (endpoint === 'data-ws') this.subscribedDataWs.add(String(msg.symbol));
          else this.subscribedLondonWs.add(String(msg.symbol));
        } else if (msg.type === 'unsubscribed' && msg.symbol) {
          if (endpoint === 'data-ws') this.subscribedDataWs.delete(String(msg.symbol));
          else this.subscribedLondonWs.delete(String(msg.symbol));
        } else if (msg.type === 'tick' && msg.symbol && typeof msg.price === 'number') {
          if (this.isPaused) return;
          this.handleIncomingTick(endpoint, msg);
        } else if (msg.type === 'error' || msg.error) {
          this.lastWsError = String(msg.message || msg.error || `${endpoint} upstream error`);
          if (endpoint === 'data-ws') this.dataWsState = 'error';
          else this.londonWsState = 'error';
        }
      } catch {
        // Ignore malformed upstream WS frame
      }
    });

    ws.on('error', (err) => {
      this.lastWsError = err?.message || `${endpoint} socket error`;
      if (endpoint === 'data-ws') this.dataWsState = 'error';
      else this.londonWsState = 'error';
    });

    ws.on('close', () => {
      if (endpoint === 'data-ws') {
        this.dataWsState = 'disconnected';
        this.subscribedDataWs.clear();
      } else {
        this.londonWsState = 'disconnected';
        this.subscribedLondonWs.clear();
      }
      if (this.intentionalStop || !this.wsActive) return;
      const t = setTimeout(() => {
        if (!this.intentionalStop && this.wsActive) {
          void this.connectUpstreamSocket(endpoint);
        }
      }, 6000);
      this.reconnectTimers.push(t);
    });
  }

  private handleIncomingTick(
    sourceSocket: 'data-ws' | 'london-ws',
    msg: { symbol: string; price: number; bid?: number; ask?: number; volume?: number; ts?: string }
  ) {
    const rawSym = String(msg.symbol).toUpperCase();
    const uiKey = this.wsToUiSymbol.get(rawSym);
    if (!uiKey) return;
    const current = this.symbols.get(uiKey);
    if (!current) return;

    const price = Number(msg.price);
    const defaultSpread = INITIAL_SYMBOLS.find((s) => s.symbol === uiKey)?.spread ?? current.tickSize * 2;
    const rawBid = typeof msg.bid === 'number' && Number.isFinite(msg.bid) ? Number(msg.bid) : NaN;
    const rawAsk = typeof msg.ask === 'number' && Number.isFinite(msg.ask) ? Number(msg.ask) : NaN;
    const maxSaneSpread = Math.max(current.tickSize * 40, price * 0.0025);
    const hasSaneBidAsk =
      Number.isFinite(rawBid) &&
      Number.isFinite(rawAsk) &&
      rawAsk > rawBid &&
      rawAsk - rawBid <= maxSaneSpread &&
      Math.abs(price - (rawBid + rawAsk) / 2) <= maxSaneSpread;

    const halfFallback = Math.max(current.tickSize, defaultSpread / 2);
    const bid = hasSaneBidAsk
      ? roundToTick(rawBid, current.tickSize, current.decimals)
      : roundToTick(price - halfFallback, current.tickSize, current.decimals);
    const ask = hasSaneBidAsk
      ? roundToTick(rawAsk, current.tickSize, current.decimals)
      : roundToTick(price + halfFallback, current.tickSize, current.decimals);
    const spread = Math.max(current.tickSize, Number((ask - bid).toFixed(current.decimals)));
    const effectiveDayOpen = current.dayOpen > 0 ? current.dayOpen : price;
    const change = Number((price - effectiveDayOpen).toFixed(current.decimals));
    const changePercent = effectiveDayOpen > 0 ? Number(((change / effectiveDayOpen) * 100).toFixed(2)) : 0;
    const volumeTick = Number(msg.volume) || 0;
    const tickIso = msg.ts || new Date().toISOString();

    const tickUnix = parseLseTimeToUnix(tickIso);
    const prevBars = this.liveBars1m.get(uiKey) || [];
    const nextBars = mergeTickIntoCandles(prevBars, price, tickUnix, volumeTick, 60);
    this.liveBars1m.set(uiKey, nextBars.length > 1440 ? nextBars.slice(-1440) : nextBars);

    const prevBars1s = this.liveBars1s.get(uiKey) || [];
    const nextBars1s = mergeTickIntoCandles(prevBars1s, price, tickUnix, volumeTick, 1);
    this.liveBars1s.set(uiKey, nextBars1s.length > 3600 ? nextBars1s.slice(-3600) : nextBars1s);

    const updated: SymbolInfo = {
      ...current,
      price,
      bid,
      ask,
      spread,
      dayOpen: effectiveDayOpen,
      change,
      changePercent,
      dayHigh: current.dayHigh > 0 ? Math.max(current.dayHigh, price) : price,
      dayLow: current.dayLow > 0 ? Math.min(current.dayLow, price) : price,
      volume24h: current.volume24h + (volumeTick > 0 ? Math.round(volumeTick) : 0),
      lastTickTs: tickIso,
      dataSource: 'lse-live',
    };

    this.symbols.set(uiKey, updated);
    this.lastTickAt = Date.now();

    this.onTickCallback?.(updated, {
      symbol: uiKey,
      price,
      bid,
      ask,
      volume: volumeTick,
      ts: tickIso,
      sourceSocket,
    });
  }
}
