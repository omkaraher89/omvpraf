export interface SymbolInfo {
  symbol: string;
  name: string;
  exchange: string;
  type: 'Futures' | 'Stock' | 'Crypto' | 'Forex' | 'Index' | 'Commodity' | 'Options';
  contractCode: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  spread: number;
  tickSize: number;
  decimals: number;
  badgeText: string;
  badgeBg: string;
  badgeColor?: string;
  flagColor?: 'red' | 'orange' | 'blue' | 'green' | null;
  volume24h: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
  // Real LSE Data 3.0 routing metadata
  lseMarket: string;
  lseHttpSymbol: string;
  lseWsSymbol?: string;
  lseWsEndpoint?: 'data-ws' | 'london-ws' | 'tsx-ws';
  lastTickTs?: string;
  dataSource?: 'lse-live' | 'lse-rest' | 'cached';
}

export interface CandleBar {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IVWallLevel {
  id: string;
  price: number;
  label: string;
  sigma: string;
  color: string;
  bgColor: string;
  textColor: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  category: 'pivot' | 'upper_1sigma' | 'lower_1sigma' | 'custom';
}

export interface SupplyDemandZone {
  id: string;
  startTimeIndex: number;
  endTimeIndex: number;
  topPrice: number;
  bottomPrice: number;
  color: string;
  borderColor: string;
  label?: string;
}

export interface NewsItem {
  id: string;
  symbol: string;
  source: string;
  timeAgo: string;
  headline: string;
  summary: string;
  sentiment: 'bearish' | 'bullish' | 'neutral';
}

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'Crossing' | 'Crossing Up' | 'Crossing Down' | 'Greater Than' | 'Less Than';
  targetPrice: number;
  note: string;
  active: boolean;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

export interface TradePosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: string;
}

/**
 * Canonical LSE Data 3.0 watchlist instruments (all prices start at 0 and hydrate strictly from LSE REST / WS).
 */
export const INITIAL_SYMBOLS: SymbolInfo[] = [
  {
    symbol: 'NASDAQ100',
    name: 'Nasdaq 100 Futures',
    exchange: 'CME',
    type: 'Futures',
    contractCode: 'FUTURES',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.25,
    tickSize: 0.25,
    decimals: 2,
    badgeText: 'ND',
    badgeBg: '#0097a7',
    flagColor: 'red',
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'futures',
    lseHttpSymbol: 'NASDAQ100',
    lseWsSymbol: 'NASDAQ100.F',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'DOW',
    name: 'Dow Jones Futures',
    exchange: 'CBOT',
    type: 'Futures',
    contractCode: 'FUTURES',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 1,
    tickSize: 1,
    decimals: 0,
    badgeText: 'DJ',
    badgeBg: '#00acc1',
    flagColor: 'red',
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'futures',
    lseHttpSymbol: 'DOW',
    lseWsSymbol: 'DOW.F',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'SP500',
    name: 'S&P 500 Futures',
    exchange: 'CME',
    type: 'Futures',
    contractCode: 'FUTURES',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.25,
    tickSize: 0.25,
    decimals: 2,
    badgeText: 'SP',
    badgeBg: '#e53935',
    flagColor: 'red',
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'futures',
    lseHttpSymbol: 'SP500',
    lseWsSymbol: 'SP500.F',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'GOLD',
    name: 'Gold Futures',
    exchange: 'COMEX',
    type: 'Futures',
    contractCode: 'FUTURES',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.1,
    tickSize: 0.1,
    decimals: 1,
    badgeText: 'AU',
    badgeBg: '#fbc02d',
    badgeColor: '#131722',
    flagColor: 'orange',
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'futures',
    lseHttpSymbol: 'GOLD',
    lseWsSymbol: 'GOLD.F',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'CRUDEOIL',
    name: 'Crude Oil Futures',
    exchange: 'NYMEX',
    type: 'Futures',
    contractCode: 'FUTURES',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.01,
    tickSize: 0.01,
    decimals: 2,
    badgeText: 'CL',
    badgeBg: '#ff8f00',
    flagColor: null,
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'futures',
    lseHttpSymbol: 'CRUDEOIL',
    lseWsSymbol: 'CRUDEOIL.F',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    exchange: 'CRYPTO',
    type: 'Crypto',
    contractCode: 'CRYPTO',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.01,
    tickSize: 0.01,
    decimals: 2,
    badgeText: '₿',
    badgeBg: '#f7931a',
    flagColor: 'blue',
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'crypto',
    lseHttpSymbol: 'BTCUSDT',
    lseWsSymbol: 'BTC/USD',
    lseWsEndpoint: 'london-ws',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    type: 'Stock',
    contractCode: 'US_STOCKS',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.01,
    tickSize: 0.01,
    decimals: 2,
    badgeText: 'NV',
    badgeBg: '#76b900',
    flagColor: null,
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'us_stocks',
    lseHttpSymbol: 'NVDA',
    lseWsSymbol: 'NVDA',
    lseWsEndpoint: 'data-ws',
  },
  {
    symbol: 'EUR_USD',
    name: 'Euro / U.S. Dollar',
    exchange: 'FX',
    type: 'Forex',
    contractCode: 'FOREX',
    currency: 'USD',
    price: 0,
    change: 0,
    changePercent: 0,
    bid: 0,
    ask: 0,
    spread: 0.00001,
    tickSize: 0.00001,
    decimals: 5,
    badgeText: 'EU',
    badgeBg: '#3949ab',
    flagColor: null,
    volume24h: 0,
    dayHigh: 0,
    dayLow: 0,
    dayOpen: 0,
    lseMarket: 'forex',
    lseHttpSymbol: 'EUR_USD',
    lseWsSymbol: 'EUR/USD',
    lseWsEndpoint: 'data-ws',
  },
];

/**
 * Formats a numeric price according to symbol decimals with thousands separators
 */
export function formatPrice(price: number, decimals: number = 2): string {
  if (!Number.isFinite(price)) return '0.00';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Normalizes a compact or padded OCC option symbol into the 21-character space-padded
 * format required by LSE /v3/preview & /v3/export (e.g. "AAPL261127P00335000" -> "AAPL  261127P00335000").
 */
export function normalizeOccSymbol(rawSymbol: string): string {
  const trimmed = String(rawSymbol || '').trim().toUpperCase();
  const match = trimmed.match(/^([A-Z0-9]{1,6})\s*(\d{6}[CP]\d{8})$/);
  if (!match) return rawSymbol;
  const root = match[1].padEnd(6, ' ');
  return `${root}${match[2]}`;
}

/**
 * Formats an OCC option ticker into a human-readable contract label (e.g. "AAPL 26-11-27 $335 P").
 */
export function formatOptionContractLabel(rawSymbol: string): string {
  const match = String(rawSymbol || '').trim().toUpperCase().match(/^([A-Z0-9]{1,6})\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
  if (!match) return rawSymbol;
  const [, root, yy, mm, dd, cp, strikeRaw] = match;
  const strike = Number(strikeRaw) / 1000;
  const strikeStr = Number.isInteger(strike) ? String(strike) : strike.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${root} ${yy}-${mm}-${dd} $${strikeStr}${cp}`;
}

/**
 * Parses LSE ISO / SQL UTC timestamps ("2026-11-13 21:59:00" or "2026-11-15T08:36:58.001Z")
 * cleanly into Unix epoch seconds.
 */
export function parseLseTimeToUnix(timeStr: string | number): number {
  if (typeof timeStr === 'number') {
    return timeStr > 1e12 ? Math.floor(timeStr / 1000) : Math.floor(timeStr);
  }
  const clean = String(timeStr || '').trim();
  if (!clean) return Math.floor(Date.now() / 1000);
  // Normalize "YYYY-MM-DD HH:MM:SS" into ISO UTC
  let iso = clean.includes('T') ? clean : clean.replace(' ', 'T');
  // Truncate sub-millisecond nanoseconds if present (e.g. .029000000Z -> .029Z)
  iso = iso.replace(/(\.\d{3})\d+/, '$1');
  if (!iso.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(iso)) {
    iso += 'Z';
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : Math.floor(Date.now() / 1000);
}

/**
 * Computes the bar open Unix timestamp bucket for a tick timestamp and timeframe duration.
 */
export function getTimeframeBucketStart(tickTimeSec: number, tfSec: number): number {
  const safeTf = Math.max(1, tfSec);
  if (safeTf >= 28 * 86400) {
    const d = new Date(tickTimeSec * 1000);
    const monthsPerBar = Math.max(1, Math.round(safeTf / (30 * 86400)));
    const monthStart = Math.floor(d.getUTCMonth() / monthsPerBar) * monthsPerBar;
    return Math.floor(Date.UTC(d.getUTCFullYear(), monthStart, 1) / 1000);
  }
  return Math.floor(tickTimeSec / safeTf) * safeTf;
}

/**
 * Merges an incoming real-time WebSocket tick into existing historical/live candles cleanly:
 * - Ignores stale/older ticks whose bucket precedes the latest stored bar.
 * - Updates high/low/close/volume in-place when inside the active candle bucket.
 * - Opens a new bar cleanly on bucket advance (and across REST-to-WS gaps opens at the
 *   real tick price rather than stretching the stale prior REST bar into a giant candle).
 */
export function mergeTickIntoCandles(
  candles: CandleBar[],
  price: number,
  tickTimeSec: number,
  volume: number,
  tfSec: number
): CandleBar[] {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tickTimeSec)) {
    return candles;
  }
  const tickBucket = getTimeframeBucketStart(tickTimeSec, tfSec);
  const tickVol = Number.isFinite(volume) && volume > 0 ? volume : 0;

  if (candles.length === 0) {
    return [
      {
        time: tickBucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: tickVol,
      },
    ];
  }

  const last = candles[candles.length - 1];

  // Ignore out-of-order / historical replay ticks older than the latest candle
  if (tickBucket < last.time) {
    return candles;
  }

  // Same candle bucket -> update OHLCV in place
  if (tickBucket === last.time) {
    const updatedLast: CandleBar = {
      ...last,
      close: price,
      high: Math.max(last.high, price),
      low: Math.min(last.low, price),
      volume: last.volume + tickVol,
    };
    return [...candles.slice(0, -1), updatedLast];
  }

  // New candle bucket strictly newer than last.time:
  // Only chain open = last.close if it is the immediately adjacent bar with no session gap & tiny delta;
  // across any REST-to-WS gap or overnight jump, open at the actual live tick price to prevent giant candles.
  const isAdjacentBar = tickBucket - last.time <= Math.max(5, tfSec);
  const relJump = last.close > 0 ? Math.abs(price - last.close) / last.close : 0;
  const newOpen = isAdjacentBar && relJump <= 0.0025 ? last.close : price;

  return [
    ...candles,
    {
      time: tickBucket,
      open: newOpen,
      high: Math.max(newOpen, price),
      low: Math.min(newOpen, price),
      close: price,
      volume: tickVol,
    },
  ];
}

/**
 * Resamples ascending candles into UTC-aligned buckets of `bucketSec` seconds (supports sub-minute & multi-minute bars).
 */
export function resampleCandlesByTime(candles: CandleBar[], bucketSec: number): CandleBar[] {
  if (bucketSec <= 1 || candles.length === 0) return candles;
  const out: CandleBar[] = [];
  for (const bar of candles) {
    const bucket = getTimeframeBucketStart(bar.time, bucketSec);
    const prev = out[out.length - 1];
    if (prev && prev.time === bucket) {
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      prev.volume += bar.volume;
    } else {
      out.push({
        time: bucket,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
    }
  }
  return out;
}

/**
 * Combines REST historical candles with newer server-accumulated live WebSocket candles without overlap.
 */
export function mergeCandleStreams(
  restCandles: CandleBar[],
  liveCandles: CandleBar[]
): CandleBar[] {
  if (liveCandles.length === 0) return restCandles;
  if (restCandles.length === 0) return liveCandles;

  const lastRest = restCandles[restCandles.length - 1];
  const merged = [...restCandles];

  for (const live of liveCandles) {
    if (live.time < lastRest.time) continue;
    const tail = merged[merged.length - 1];
    if (live.time === tail.time) {
      merged[merged.length - 1] = {
        ...tail,
        high: Math.max(tail.high, live.high),
        low: Math.min(tail.low, live.low),
        close: live.close,
        volume: Math.max(tail.volume, live.volume),
      };
    } else if (live.time > tail.time) {
      merged.push(live);
    }
  }
  return merged;
}

/**
 * Maps TradingView toolbar / custom timeframe tokens to LSE Data 3.0 API parameters
 * and optional server-side resampling factor.
 */
export function mapTimeframeToLse(tf: string): {
  lseTimeframe: string;
  resampleMinutes: number;
  resampleMonths: number;
  bucketSeconds: number;
} {
  const clean = tf.trim();
  const bucketSeconds = parseTimeframeToSeconds(clean);

  switch (clean) {
    case '1s':
    case '5s':
    case '15s':
    case '30s':
    case '1m':
    case '3m':
    case '5m':
    case '15m':
    case '30m':
    case '1h':
    case '4h':
      return { lseTimeframe: clean, resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
    case 'D':
    case '1D':
      return { lseTimeframe: '1d', resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
    case 'W':
    case '1W':
      return { lseTimeframe: '1w', resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
    case 'M':
    case '1M':
      return { lseTimeframe: '1mo', resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
    case '3M':
      return { lseTimeframe: '1mo', resampleMinutes: 1, resampleMonths: 3, bucketSeconds };
    case '6M':
      return { lseTimeframe: '1mo', resampleMinutes: 1, resampleMonths: 6, bucketSeconds };
    case '12M':
    case '1Y':
      return { lseTimeframe: '1mo', resampleMinutes: 1, resampleMonths: 12, bucketSeconds };
    default: {
      // Custom intervals (e.g. 2s, 10s, 20s, 45s, 2m, 7m, 10m, 45m, 2h, 6h, 3D)
      if (clean.endsWith('s')) {
        const secs = Math.max(1, parseInt(clean, 10) || 1);
        const baseSecondsTf =
          secs % 30 === 0
            ? '30s'
            : secs % 15 === 0
            ? '15s'
            : secs % 5 === 0
            ? '5s'
            : '1s';
        return { lseTimeframe: baseSecondsTf, resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
      }
      if (clean.endsWith('m')) {
        const mins = Math.max(1, parseInt(clean, 10) || 1);
        return { lseTimeframe: '1m', resampleMinutes: mins, resampleMonths: 1, bucketSeconds };
      }
      if (clean.endsWith('h')) {
        const hrs = Math.max(1, parseInt(clean, 10) || 1);
        return { lseTimeframe: '1h', resampleMinutes: hrs, resampleMonths: 1, bucketSeconds };
      }
      if (clean.endsWith('D') || clean.endsWith('d')) {
        const days = Math.max(1, parseInt(clean, 10) || 1);
        return { lseTimeframe: '1d', resampleMinutes: days, resampleMonths: 1, bucketSeconds };
      }
      if (clean.endsWith('W') || clean.endsWith('w')) {
        const wks = Math.max(1, parseInt(clean, 10) || 1);
        return { lseTimeframe: '1w', resampleMinutes: wks, resampleMonths: 1, bucketSeconds };
      }
      if (clean.endsWith('M')) {
        const mos = Math.max(1, parseInt(clean, 10) || 1);
        return { lseTimeframe: '1mo', resampleMinutes: 1, resampleMonths: mos, bucketSeconds };
      }
      return { lseTimeframe: '1m', resampleMinutes: 1, resampleMonths: 1, bucketSeconds };
    }
  }
}

/**
 * Filters intraday candles between ETH (Extended Trading Hours) and RTH (Regular US Session 14:30-21:00 UTC)
 */
const NEW_YORK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Minutes since midnight in New York, honouring EST/EDT instead of a fixed UTC offset. */
function getNewYorkMinutesOfDay(timeSec: number): number {
  const parts = NEW_YORK_TIME_FORMATTER.formatToParts(new Date(timeSec * 1000));
  let hours = 0;
  let minutes = 0;
  for (const part of parts) {
    if (part.type === 'hour') hours = Number(part.value) % 24;
    else if (part.type === 'minute') minutes = Number(part.value);
  }
  return hours * 60 + minutes;
}

export function filterCandlesBySession(candles: CandleBar[], session: 'ETH' | 'RTH'): CandleBar[] {
  if (session === 'ETH' || candles.length < 2) return candles;
  const intervalSec = candles[1].time - candles[0].time;
  // Only filter intraday timeframes (< 1 day)
  if (intervalSec >= 86400) return candles;
  // US index futures RTH runs 09:30-16:15 ET, so a 1m bar stamped 16:14 is the last one that closes at the bell.
  const sessionStartMin = 9 * 60 + 30;
  const sessionEndMin = 16 * 60 + 14;
  const filtered = candles.filter((c) => {
    const mins = getNewYorkMinutesOfDay(c.time);
    return mins >= sessionStartMin && mins <= sessionEndMin;
  });
  return filtered.length >= 10 ? filtered : candles;
}

/**
 * Parses a timeframe string (e.g., '1m', '5m', '1h', '4h', 'D', 'W', 'M', '7m', '15s')
 * into duration in seconds.
 */
export function parseTimeframeToSeconds(tf: string): number {
  const clean = tf.trim();
  if (!clean) return 60;

  if (clean === 'D' || clean === '1D') return 86400;
  if (clean === 'W' || clean === '1W') return 86400 * 7;
  if (clean === 'M' || clean === '1M') return 86400 * 30;
  if (clean === '3M') return 86400 * 90;
  if (clean === '6M') return 86400 * 180;
  if (clean === '12M' || clean === '1Y') return 86400 * 365;

  const match = clean.match(/^(\d+)\s*([smhdwMyT])$/);
  if (!match) {
    const numOnly = parseInt(clean, 10);
    return Number.isFinite(numOnly) && numOnly > 0 ? numOnly * 60 : 60;
  }

  const val = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
    case 'T':
      return Math.max(1, val);
    case 'm':
      return val * 60;
    case 'h':
      return val * 3600;
    case 'd':
      return val * 86400;
    case 'w':
      return val * 86400 * 7;
    case 'M':
      return val * 86400 * 30;
    case 'y':
      return val * 86400 * 365;
    default:
      return 60;
  }
}

/**
 * Converts a timeframe toolbar code ('1m', '15m', '1h', 'D') into the TradingView chart title token ('1', '15', '60', '1D')
 */
export function formatTimeframeHeaderLabel(tf: string): string {
  const clean = tf.trim();
  if (clean.endsWith('m')) {
    return clean.slice(0, -1);
  }
  if (clean === '1h') return '60';
  if (clean === '2h') return '120';
  if (clean === '4h') return '240';
  return clean;
}

/**
 * Validates and normalizes a user-created custom timeframe string (e.g. value=7, unit='m' -> '7m')
 */
export function buildCustomTimeframe(value: number, unit: 's' | 'm' | 'h' | 'D' | 'W' | 'M'): string | null {
  if (!Number.isFinite(value) || value <= 0 || value > 1000) return null;
  const intVal = Math.floor(value);
  if (unit === 'D' && intVal === 1) return 'D';
  if (unit === 'W' && intVal === 1) return 'W';
  if (unit === 'M' && intVal === 1) return 'M';
  return `${intVal}${unit}`;
}

export function roundToTick(value: number, tickSize: number, decimals: number): number {
  const safeTick = tickSize > 0 ? tickSize : 0.01;
  const ticks = Math.round(value / safeTick);
  return Number((ticks * safeTick).toFixed(decimals));
}

export function toHeikinAshiCandles(candles: CandleBar[]): CandleBar[] {
  if (candles.length === 0) return [];
  const result: CandleBar[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (result[i - 1].open + result[i - 1].close) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    result.push({
      time: c.time,
      open: Number(haOpen.toFixed(4)),
      high: Number(haHigh.toFixed(4)),
      low: Number(haLow.toFixed(4)),
      close: Number(haClose.toFixed(4)),
      volume: c.volume,
    });
  }
  return result;
}

export function resampleCandles(candles: CandleBar[], bucketSize: number): CandleBar[] {
  if (bucketSize <= 1 || candles.length === 0) return candles;
  const aggregated: CandleBar[] = [];
  for (let i = 0; i < candles.length; i += bucketSize) {
    const slice = candles.slice(i, i + bucketSize);
    if (slice.length === 0) continue;
    const open = slice[0].open;
    const close = slice[slice.length - 1].close;
    let high = slice[0].high;
    let low = slice[0].low;
    let volume = 0;
    for (const bar of slice) {
      if (bar.high > high) high = bar.high;
      if (bar.low < low) low = bar.low;
      volume += bar.volume;
    }
    aggregated.push({
      time: slice[0].time,
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return aggregated;
}

export function calculateSMA(candles: CandleBar[], period: number): Array<{ time: number; value: number }> {
  if (period <= 0 || candles.length < period) return [];
  const out: Array<{ time: number; value: number }> = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) {
      sum -= candles[i - period].close;
    }
    if (i >= period - 1) {
      out.push({
        time: candles[i].time,
        value: Number((sum / period).toFixed(4)),
      });
    }
  }
  return out;
}

export function calculateEMA(candles: CandleBar[], period: number): Array<{ time: number; value: number }> {
  if (period <= 0 || candles.length < period) return [];
  const out: Array<{ time: number; value: number }> = [];
  const k = 2 / (period + 1);
  let ema = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0) / period;
  out.push({ time: candles[period - 1].time, value: Number(ema.toFixed(4)) });

  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: Number(ema.toFixed(4)) });
  }
  return out;
}

export function calculateVWAP(candles: CandleBar[]): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    const vol = Math.max(1, c.volume);
    cumPV += typical * vol;
    cumVol += vol;
    out.push({
      time: c.time,
      value: Number((cumPV / cumVol).toFixed(4)),
    });
  }
  return out;
}

export function calculateBollingerBands(
  candles: CandleBar[],
  period: number = 20,
  mult: number = 2
): {
  upper: Array<{ time: number; value: number }>;
  middle: Array<{ time: number; value: number }>;
  lower: Array<{ time: number; value: number }>;
} {
  const upper: Array<{ time: number; value: number }> = [];
  const middle: Array<{ time: number; value: number }> = [];
  const lower: Array<{ time: number; value: number }> = [];
  if (candles.length < period) return { upper, middle, lower };

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) sq += (candles[j].close - mean) ** 2;
    const sd = Math.sqrt(sq / period);
    const t = candles[i].time;
    middle.push({ time: t, value: Number(mean.toFixed(4)) });
    upper.push({ time: t, value: Number((mean + mult * sd).toFixed(4)) });
    lower.push({ time: t, value: Number((mean - mult * sd).toFixed(4)) });
  }
  return { upper, middle, lower };
}

/**
 * Computes Institutional IV WALLS (session pivot + 1σ realized volatility bands)
 * strictly from real loaded OHLC candles. Returns empty array when candles are insufficient.
 */
export function getInstitutionalIVWalls(
  symbolInfo: SymbolInfo,
  candles?: CandleBar[]
): IVWallLevel[] {
  if (!candles || candles.length < 20) return [];
  const d = symbolInfo.decimals;
  const t = symbolInfo.tickSize;
  const recent = candles.slice(-Math.min(candles.length, 120));
  let sessionHigh = -Infinity;
  let sessionLow = Infinity;
  let sumReturnsSq = 0;
  let countRet = 0;

  for (let i = 0; i < recent.length; i++) {
    if (recent[i].high > sessionHigh) sessionHigh = recent[i].high;
    if (recent[i].low < sessionLow) sessionLow = recent[i].low;
    if (i > 0 && recent[i - 1].close > 0 && recent[i].close > 0) {
      const ret = Math.log(recent[i].close / recent[i - 1].close);
      sumReturnsSq += ret * ret;
      countRet++;
    }
  }

  const lastClose = recent[recent.length - 1].close;
  if (!Number.isFinite(lastClose) || lastClose <= 0) return [];
  const barSigma = countRet > 0 ? Math.sqrt(sumReturnsSq / countRet) : 0.0012;
  const sigmaMove = Math.max(lastClose * 0.0015, lastClose * barSigma * Math.sqrt(28));
  const rVal = (v: number) => roundToTick(v, t, d);

  const pivot = rVal((sessionHigh + sessionLow + lastClose) / 3);
  const u1 = rVal(lastClose + sigmaMove * 1.15);
  const u2 = rVal(lastClose + sigmaMove * 0.92);
  const u3 = rVal(lastClose + sigmaMove * 0.85);
  const u4 = rVal(lastClose + sigmaMove * 0.78);
  const l1 = rVal(Math.max(t, lastClose - sigmaMove * 0.88));
  const l2 = rVal(Math.max(t, lastClose - sigmaMove * 1.15));

  return [
    {
      id: 'iv-pivot-high',
      price: pivot,
      label: formatPrice(pivot, d),
      sigma: '',
      color: '#363a45',
      bgColor: '#363a45',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'pivot',
    },
    {
      id: 'iv-u1',
      price: u1,
      label: formatPrice(u1, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-u2',
      price: u2,
      label: formatPrice(u2, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-u3',
      price: u3,
      label: formatPrice(u3, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-u4',
      price: u4,
      label: formatPrice(u4, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'upper_1sigma',
    },
    {
      id: 'iv-l1',
      price: l1,
      label: formatPrice(l1, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'lower_1sigma',
    },
    {
      id: 'iv-l2',
      price: l2,
      label: formatPrice(l2, d),
      sigma: '1σ',
      color: '#2962ff',
      bgColor: '#2962ff',
      textColor: '#ffffff',
      lineStyle: 'solid',
      category: 'lower_1sigma',
    },
  ];
}

/**
 * Computes Quantum Wealth SSMT liquidity & swing order-block zones dynamically from actual OHLC candles.
 */
export function getSupplyDemandZones(symbolInfo: SymbolInfo, candles: CandleBar[]): SupplyDemandZone[] {
  if (candles.length < 30) return [];
  const n = candles.length;
  const walls = getInstitutionalIVWalls(symbolInfo, candles);
  if (walls.length < 7) return [];
  const u1 = walls.find((w) => w.id === 'iv-u1')?.price ?? candles[n - 1].close * 1.002;
  const u4 = walls.find((w) => w.id === 'iv-u4')?.price ?? candles[n - 1].close * 1.001;
  const l1 = walls.find((w) => w.id === 'iv-l1')?.price ?? candles[n - 1].close * 0.998;
  const l2 = walls.find((w) => w.id === 'iv-l2')?.price ?? candles[n - 1].close * 0.997;

  const seg1Start = Math.floor(n * 0.25);
  const seg1End = Math.floor(n * 0.45);
  const seg2Start = Math.floor(n * 0.48);
  const seg2End = Math.floor(n * 0.72);

  let seg1Hi = candles[seg1Start].high;
  let seg1Lo = candles[seg1Start].low;
  for (let i = seg1Start; i <= seg1End && i < n; i++) {
    if (candles[i].high > seg1Hi) seg1Hi = candles[i].high;
    if (candles[i].low < seg1Lo) seg1Lo = candles[i].low;
  }

  let seg2Hi = candles[seg2Start].high;
  let seg2Lo = candles[seg2Start].low;
  for (let i = seg2Start; i <= seg2End && i < n; i++) {
    if (candles[i].high > seg2Hi) seg2Hi = candles[i].high;
    if (candles[i].low < seg2Lo) seg2Lo = candles[i].low;
  }

  const band1 = Math.max(symbolInfo.tickSize * 4, (seg1Hi - seg1Lo) * 0.14);
  const band2 = Math.max(symbolInfo.tickSize * 4, (seg2Hi - seg2Lo) * 0.16);

  return [
    {
      id: 'zone-1',
      startTimeIndex: seg1Start,
      endTimeIndex: seg1End,
      topPrice: seg1Hi,
      bottomPrice: seg1Hi - band1,
      color: 'rgba(102, 187, 106, 0.20)',
      borderColor: 'rgba(76, 175, 80, 0.45)',
    },
    {
      id: 'zone-2',
      startTimeIndex: seg2Start,
      endTimeIndex: seg2End,
      topPrice: seg2Lo + band2,
      bottomPrice: seg2Lo,
      color: 'rgba(129, 199, 132, 0.22)',
      borderColor: 'rgba(76, 175, 80, 0.50)',
    },
    {
      id: 'zone-upper-1sigma',
      startTimeIndex: Math.floor(n * 0.82),
      endTimeIndex: n - 1,
      topPrice: Math.max(u1, u4),
      bottomPrice: Math.min(u1, u4),
      color: 'rgba(129, 199, 132, 0.26)',
      borderColor: 'rgba(41, 98, 255, 0.45)',
    },
    {
      id: 'zone-lower-1sigma',
      startTimeIndex: Math.floor(n * 0.82),
      endTimeIndex: n - 1,
      topPrice: Math.max(l1, l2),
      bottomPrice: Math.min(l1, l2),
      color: 'rgba(129, 199, 132, 0.26)',
      borderColor: 'rgba(41, 98, 255, 0.45)',
    },
  ];
}

export function calculatePositionPnL(position: TradePosition, currentPrice: number): {
  pointsDiff: number;
  dollarPnL: number;
  percentPnL: number;
} {
  const direction = position.side === 'BUY' ? 1 : -1;
  const pointsDiff = (currentPrice - position.entryPrice) * direction;
  const multiplier =
    position.symbol === 'NASDAQ100'
      ? 20
      : position.symbol === 'SP500'
      ? 50
      : position.symbol === 'DOW'
      ? 5
      : 10;
  const dollarPnL = Number((pointsDiff * position.qty * multiplier).toFixed(2));
  const percentPnL = position.entryPrice > 0 ? Number(((pointsDiff / position.entryPrice) * 100).toFixed(2)) : 0;
  return {
    pointsDiff: Number(pointsDiff.toFixed(4)),
    dollarPnL,
    percentPnL,
  };
}

export function evaluateAlertTrigger(
  alert: PriceAlert,
  prevPrice: number,
  newPrice: number
): boolean {
  if (!alert.active || alert.triggered) return false;
  const target = alert.targetPrice;
  switch (alert.condition) {
    case 'Crossing':
      return (prevPrice < target && newPrice >= target) || (prevPrice > target && newPrice <= target);
    case 'Crossing Up':
      return prevPrice < target && newPrice >= target;
    case 'Crossing Down':
      return prevPrice > target && newPrice <= target;
    case 'Greater Than':
      return newPrice > target;
    case 'Less Than':
      return newPrice < target;
    default:
      return false;
  }
}
