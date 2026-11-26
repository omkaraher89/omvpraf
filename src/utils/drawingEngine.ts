import { CandleBar, roundToTick } from './marketEngine';
import { ChartDrawing, DrawingPoint, DrawingToolId } from '../types/trading';

export interface PixelPoint {
  x: number;
  y: number;
}

export type CoordToPixelFn = (t: number, p: number) => { x: number | null; y: number | null };

export interface HitTestResult {
  drawingId: string;
  handleIndex: number | null; // null means body hit, >= 0 means specific anchor handle index
}

export interface VolumeProfileRow {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  ratio: number; // 0..1 normalized to max row volume
  isPOC: boolean;
  inValueArea?: boolean;
}

export type VolumeProfilePeriodMode = 'prev_day' | 'prev_week';

export interface VolumeProfileResult {
  rows: VolumeProfileRow[];
  pocPrice: number;
  pocVolume: number;
  vahPrice: number;
  valPrice: number;
  lowPrice: number;
  highPrice: number;
  totalVolume: number;
  valueAreaVolume: number;
  barsCount: number;
  periodLabel?: string;
}

export interface PositionStats {
  entry: number;
  target: number;
  stop: number;
  rewardPoints: number;
  riskPoints: number;
  rewardPercent: number;
  riskPercent: number;
  riskRewardRatio: number;
}

export interface MeasureStats {
  priceDiff: number;
  percentDiff: number;
  barsCount: number;
  durationLabel: string;
  angleDeg: number;
}

/**
 * Returns how many anchor clicks/points a drawing tool expects before auto-completing.
 * Returns 'multi' for polylines/Elliott waves, 'freehand' for brush/highlighter.
 */
export function getToolPointMode(tool: DrawingToolId): 1 | 2 | 3 | 'multi' | 'freehand' {
  switch (tool) {
    case 'horizontal-line':
    case 'horizontal-ray':
    case 'vertical-line':
    case 'cross-line':
    case 'text-note':
    case 'price-label':
    case 'long-position':
    case 'short-position':
      return 1;
    case 'pitchfork':
    case 'fib-extension':
    case 'parallel-channel':
    case 'triangle':
      return 3;
    case 'wave-path':
    case 'elliott-wave':
      return 'multi';
    case 'brush':
    case 'highlighter':
      return 'freehand';
    default:
      return 2;
  }
}

/**
 * Human-friendly label for every drawing tool
 */
export function getToolDisplayName(tool: DrawingToolId): string {
  const names: Record<DrawingToolId, string> = {
    cursor: 'Crosshair',
    'trend-line': 'Trend Line',
    ray: 'Ray',
    'info-line': 'Info Line',
    'extended-line': 'Extended Line',
    'horizontal-line': 'Horizontal Line',
    'horizontal-ray': 'Horizontal Ray',
    'vertical-line': 'Vertical Line',
    'cross-line': 'Cross Line',
    'parallel-channel': 'Parallel Channel',
    'fib-levels': 'Fib Retracement',
    'fib-extension': 'Trend-Based Fib Extension',
    pitchfork: 'Andrews Pitchfork',
    'liquidity-box': 'Liquidity Pool Channel (L)',
    'stop-channel': 'Settlement / Stop Zone (S)',
    brush: 'Brush',
    highlighter: 'Highlighter',
    rectangle: 'Rectangle',
    circle: 'Circle / Ellipse',
    triangle: 'Triangle',
    'text-note': 'Text',
    callout: 'Callout',
    'price-label': 'Price Note',
    'long-position': 'Long Position',
    'short-position': 'Short Position',
    'price-range': 'Price Range',
    'date-range': 'Date Range',
    'volume-profile': 'Fixed Range Volume Profile',
    'candle-pattern': 'Bars Pattern',
    'wave-path': 'Polyline / Path',
    'elliott-wave': 'Elliott Impulse Wave (12345)',
    'time-cycles': 'Fib Time Zones',
    measure: 'Measure',
  };
  return names[tool] || tool;
}

export function isLineToolId(tool: DrawingToolId): boolean {
  return (
    tool === 'trend-line' ||
    tool === 'ray' ||
    tool === 'info-line' ||
    tool === 'extended-line' ||
    tool === 'horizontal-line' ||
    tool === 'horizontal-ray' ||
    tool === 'vertical-line' ||
    tool === 'cross-line'
  );
}

export function supportsAngleSnapTool(tool: DrawingToolId): boolean {
  return (
    tool === 'trend-line' ||
    tool === 'ray' ||
    tool === 'info-line' ||
    tool === 'extended-line' ||
    tool === 'parallel-channel' ||
    tool === 'fib-levels' ||
    tool === 'wave-path' ||
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'triangle'
  );
}

export function supportsRichTextTool(tool: DrawingToolId): boolean {
  return (
    isLineToolId(tool) ||
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'triangle' ||
    tool === 'parallel-channel' ||
    tool === 'liquidity-box' ||
    tool === 'stop-channel' ||
    tool === 'text-note' ||
    tool === 'callout' ||
    tool === 'price-label'
  );
}

/**
 * Returns TradingView's 8 resize handles for a 2-point rectangle:
 * 0: p0, 1: p1, 2: (p1.x, p0.y), 3: (p0.x, p1.y),
 * 4: top/p0.y mid, 5: bot/p1.y mid, 6: left/p0.x mid, 7: right/p1.x mid
 */
export function getRectangleHandles(p0: PixelPoint, p1: PixelPoint): PixelPoint[] {
  const midX = (p0.x + p1.x) / 2;
  const midY = (p0.y + p1.y) / 2;
  return [
    p0,
    p1,
    { x: p1.x, y: p0.y },
    { x: p0.x, y: p1.y },
    { x: midX, y: p0.y },
    { x: midX, y: p1.y },
    { x: p0.x, y: midY },
    { x: p1.x, y: midY },
  ];
}

/**
 * Snaps a raw price to the nearest OHLC value of the candle at `timeSec` when magnet mode is active.
 * Uses O(log N) binary search and optional vertical proximity cap (`maxPriceDelta`) for TradingView-style weak magnet feel.
 */
export function snapPriceToCandle(
  candles: CandleBar[],
  timeSec: number,
  rawPrice: number,
  magnetMode: boolean,
  tickSize: number,
  decimals: number,
  maxPriceDelta?: number
): number {
  if (!magnetMode || candles.length === 0) {
    return roundToTick(rawPrice, tickSize, decimals);
  }

  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < timeSec) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  let nearest = candles[lo];
  if (lo > 0 && Math.abs(candles[lo - 1].time - timeSec) < Math.abs(nearest.time - timeSec)) {
    nearest = candles[lo - 1];
  }

  const step =
    candles.length >= 2
      ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
      : 60;
  // Do not snap horizontally/OHLC when cursor is beyond 1.5 bars into right future whitespace
  if (Math.abs(nearest.time - timeSec) > step * 1.5) {
    return roundToTick(rawPrice, tickSize, decimals);
  }

  let bestOhlc = nearest.open;
  let bestDiff = Math.abs(nearest.open - rawPrice);
  const ohlc = [nearest.high, nearest.low, nearest.close];
  for (let i = 0; i < ohlc.length; i++) {
    const d = Math.abs(ohlc[i] - rawPrice);
    if (d < bestDiff) {
      bestDiff = d;
      bestOhlc = ohlc[i];
    }
  }

  if (maxPriceDelta !== undefined && bestDiff > maxPriceDelta) {
    return roundToTick(rawPrice, tickSize, decimals);
  }
  return bestOhlc;
}

/**
 * Core Volume-by-Price Profile engine computing histogram rows, Point of Control (POC),
 * and contiguous Value Area (VAL..VAH) covering `valueAreaPct` (default 70%) of volume.
 */
export function calculateVolumeProfileFromBars(
  slice: CandleBar[],
  rowCount: number = 32,
  valueAreaPct: number = 0.7,
  lowOverride?: number,
  highOverride?: number
): VolumeProfileResult {
  const safeRows = Math.max(8, Math.min(120, Math.round(rowCount)));
  const safeVaPct = Math.min(0.95, Math.max(0.1, valueAreaPct));

  let low =
    lowOverride !== undefined && Number.isFinite(lowOverride) ? lowOverride : Infinity;
  let high =
    highOverride !== undefined && Number.isFinite(highOverride) ? highOverride : -Infinity;

  if (slice.length > 0 && (!Number.isFinite(low) || !Number.isFinite(high) || Math.abs(high - low) < 1e-9)) {
    let minL = Infinity;
    let maxH = -Infinity;
    for (const c of slice) {
      if (Number.isFinite(c.low) && c.low < minL) minL = c.low;
      if (Number.isFinite(c.high) && c.high > maxH) maxH = c.high;
    }
    if (Number.isFinite(minL) && Number.isFinite(maxH)) {
      low = minL;
      high = maxH;
    }
  }

  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) {
    low = 0;
    high = 1;
  }

  const span = Math.max(1e-6, high - low);
  const step = span / safeRows;

  const buckets = Array.from({ length: safeRows }, (_, idx) => ({
    priceLow: low + idx * step,
    priceHigh: low + (idx + 1) * step,
    priceMid: low + (idx + 0.5) * step,
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
  }));

  let totalVolume = 0;
  for (const bar of slice) {
    const vol = Math.max(0, Number.isFinite(bar.volume) ? bar.volume : 0);
    if (vol <= 0) continue;

    const barRange = Math.max(0, bar.high - bar.low);
    const isBull = bar.close >= bar.open;
    const clv = barRange > 1e-9 ? Math.min(1, Math.max(0, (bar.close - bar.low) / barRange)) : isBull ? 1 : 0;
    const buyFrac = isBull ? 0.58 + 0.42 * clv : 0.42 * clv;

    const iLow = Math.max(0, Math.min(safeRows - 1, Math.floor((bar.low - low) / step)));
    const iHigh = Math.max(0, Math.min(safeRows - 1, Math.floor((bar.high - low) / step)));
    const firstIdx = Math.min(iLow, iHigh);
    const lastIdx = Math.max(iLow, iHigh);
    const touchedCount = lastIdx - firstIdx + 1;
    const volPerBucket = vol / touchedCount;
    const buyPerBucket = volPerBucket * buyFrac;
    const sellPerBucket = volPerBucket * (1 - buyFrac);

    for (let idx = firstIdx; idx <= lastIdx; idx++) {
      buckets[idx].volume += volPerBucket;
      buckets[idx].buyVolume += buyPerBucket;
      buckets[idx].sellVolume += sellPerBucket;
    }
    totalVolume += vol;
  }

  let maxVol = -1;
  let pocIdx = Math.floor(safeRows / 2);
  const centerIdx = (safeRows - 1) / 2;
  for (let i = 0; i < buckets.length; i++) {
    const v = buckets[i].volume;
    if (
      v > maxVol + 1e-9 ||
      (Math.abs(v - maxVol) <= 1e-9 && Math.abs(i - centerIdx) < Math.abs(pocIdx - centerIdx))
    ) {
      maxVol = v;
      pocIdx = i;
    }
  }
  maxVol = Math.max(0, maxVol);

  // Compute Value Area (VAH / VAL) via standard dual-sided expansion from POC
  let loIdx = pocIdx;
  let hiIdx = pocIdx;
  let accumVol = totalVolume > 0 ? buckets[pocIdx].volume : 0;
  const targetVol = totalVolume * safeVaPct;

  while (totalVolume > 0 && accumVol < targetVol && (loIdx > 0 || hiIdx < safeRows - 1)) {
    const upVol = hiIdx + 1 < safeRows ? buckets[hiIdx + 1].volume : -1;
    const dnVol = loIdx - 1 >= 0 ? buckets[loIdx - 1].volume : -1;

    if (upVol < 0 && dnVol < 0) break;
    if (upVol > dnVol) {
      hiIdx += 1;
      accumVol += upVol;
    } else if (dnVol > upVol) {
      loIdx -= 1;
      accumVol += dnVol;
    } else if (hiIdx + 1 < safeRows) {
      hiIdx += 1;
      accumVol += upVol;
    } else if (loIdx - 1 >= 0) {
      loIdx -= 1;
      accumVol += dnVol;
    }
  }

  const rows: VolumeProfileRow[] = buckets.map((b, i) => ({
    ...b,
    ratio: maxVol > 0 ? b.volume / maxVol : 0,
    isPOC: totalVolume > 0 && i === pocIdx,
    inValueArea: totalVolume > 0 && i >= loIdx && i <= hiIdx,
  }));

  return {
    rows,
    pocPrice: buckets[pocIdx]?.priceMid ?? (low + high) / 2,
    pocVolume: buckets[pocIdx]?.volume ?? 0,
    vahPrice: buckets[hiIdx]?.priceHigh ?? high,
    valPrice: buckets[loIdx]?.priceLow ?? low,
    lowPrice: low,
    highPrice: high,
    totalVolume,
    valueAreaVolume: accumVol,
    barsCount: slice.length,
  };
}

/**
 * Computes Visible Range Volume Profile (VRVP) strictly from the candle slice
 * currently visible in the active chart viewport [logicalFrom..logicalTo].
 */
export function computeVisibleVolumeProfile(
  candles: CandleBar[],
  logicalFrom: number,
  logicalTo: number,
  rowCount: number = 32,
  valueAreaPct: number = 0.7
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;
  const startIdx = Math.max(0, Math.floor(Number.isFinite(logicalFrom) ? logicalFrom : 0));
  const endIdx = Math.min(
    candles.length - 1,
    Math.ceil(Number.isFinite(logicalTo) ? logicalTo : candles.length - 1)
  );
  if (endIdx < startIdx) return null;

  const visibleSlice = candles.slice(startIdx, endIdx + 1);
  if (visibleSlice.length === 0) return null;

  return calculateVolumeProfileFromBars(visibleSlice, rowCount, valueAreaPct);
}

const tzDatePartsCache = new Map<string, Intl.DateTimeFormat>();

function getTzPartsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = tzDatePartsCache.get(timeZone);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
      });
    } catch {
      fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
      });
    }
    tzDatePartsCache.set(timeZone, fmt);
  }
  return fmt;
}

function addCalendarDays(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function getMondayKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function formatShortMonthDay(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[(m - 1) % 12]} ${d}`;
}

function extractSessionKeys(
  candles: CandleBar[],
  timeZone: string
): Array<{ dateKey: string; sessionKey: string; dow: number; hour: number }> {
  const fmt = getTzPartsFormatter(timeZone);
  const raw = candles.map((c) => {
    const parts = fmt.formatToParts(new Date(c.time * 1000));
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    const hRaw = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const hour = hRaw === 24 ? 0 : hRaw;
    const dateKey = `${y}-${m}-${d}`;
    const dow = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
    return { dateKey, dow, hour };
  });

  // Detect 24/7 Sunday (e.g. Crypto) vs Sunday evening futures/FX reopen (>= 17:00 local)
  const sundayHasMorningBars = new Map<string, boolean>();
  for (const item of raw) {
    if (item.dow === 0 && item.hour < 17) {
      sundayHasMorningBars.set(item.dateKey, true);
    }
  }

  return raw.map((item) => {
    const isGlobexSundayOpen =
      item.dow === 0 && item.hour >= 17 && !sundayHasMorningBars.get(item.dateKey);
    const sessionKey = isGlobexSundayOpen ? addCalendarDays(item.dateKey, 1) : item.dateKey;
    return { ...item, sessionKey };
  });
}

/**
 * Checks whether a candle array already covers at least one complete preceding
 * trading day or week before the current active session so we know whether
 * supplemental history needs to be loaded.
 */
export function hasCompletePreviousPeriod(
  candles: CandleBar[],
  periodMode: VolumeProfilePeriodMode,
  timeZone: string = 'America/New_York'
): boolean {
  if (!candles || candles.length === 0) return false;
  const meta = extractSessionKeys(candles, timeZone);
  if (periodMode === 'prev_day') {
    const distinctDays = new Set(meta.map((m) => m.sessionKey));
    return distinctDays.size >= 3;
  }
  const distinctWeeks = new Set(meta.map((m) => getMondayKey(m.sessionKey)));
  return distinctWeeks.size >= 3;
}

/**
 * Computes Previous Day or Previous Week Volume Profile (histogram, POC, and 70% VA)
 * using timezone-aligned trading session boundaries.
 */
export function computePeriodVolumeProfile(
  candles: CandleBar[],
  periodMode: VolumeProfilePeriodMode,
  rowCount: number = 32,
  valueAreaPct: number = 0.7,
  timeZone: string = 'America/New_York'
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;

  const meta = extractSessionKeys(candles, timeZone);
  const latestSessionKey = meta[meta.length - 1].sessionKey;

  if (periodMode === 'prev_day') {
    const sortedDays = Array.from(new Set(meta.map((m) => m.sessionKey))).sort();
    const prevIdx = sortedDays.lastIndexOf(latestSessionKey) - 1;
    if (prevIdx < 0) return null;
    const targetDay = sortedDays[prevIdx];
    const slice: CandleBar[] = [];
    for (let i = 0; i < candles.length; i++) {
      if (meta[i].sessionKey === targetDay) slice.push(candles[i]);
    }
    if (slice.length === 0) return null;
    const res = calculateVolumeProfileFromBars(slice, rowCount, valueAreaPct);
    return {
      ...res,
      periodLabel: `Prev Day · ${formatShortMonthDay(targetDay)}`,
    };
  }

  // prev_week
  const latestWeekKey = getMondayKey(latestSessionKey);
  const weekKeys = meta.map((m) => getMondayKey(m.sessionKey));
  const sortedWeeks = Array.from(new Set(weekKeys)).sort();
  const prevWeekIdx = sortedWeeks.lastIndexOf(latestWeekKey) - 1;
  if (prevWeekIdx < 0) return null;
  const targetWeek = sortedWeeks[prevWeekIdx];
  const slice: CandleBar[] = [];
  const daysInWeek = new Set<string>();
  for (let i = 0; i < candles.length; i++) {
    if (weekKeys[i] === targetWeek) {
      slice.push(candles[i]);
      daysInWeek.add(meta[i].sessionKey);
    }
  }
  if (slice.length === 0) return null;
  const sortedWeekDays = Array.from(daysInWeek).sort();
  const startLabel = formatShortMonthDay(sortedWeekDays[0]);
  const endLabel = formatShortMonthDay(sortedWeekDays[sortedWeekDays.length - 1]);
  const res = calculateVolumeProfileFromBars(slice, rowCount, valueAreaPct);
  return {
    ...res,
    periodLabel: `Prev Week · ${startLabel}–${endLabel}`,
  };
}

/**
 * Computes Fixed-Range Volume-by-Price Profile from candles within [t1, t2] and price range [p1, p2].
 */
export function computeVolumeProfile(
  candles: CandleBar[],
  t1: number,
  t2: number,
  p1: number,
  p2: number,
  rowCount: number = 14
): VolumeProfileResult {
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const slice = candles.filter((c) => c.time >= tMin && c.time <= tMax);
  const low = Math.min(p1, p2);
  const high = Math.max(p1, p2);
  return calculateVolumeProfileFromBars(slice, rowCount, 0.7, low, high);
}

export const DEFAULT_FIB_RETRACEMENT_RATIOS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618,
];

export const DEFAULT_FIB_EXTENSION_RATIOS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618,
];

/**
 * Computes Fibonacci Retracement levels between anchor points p1 (start) and p2 (end).
 * When `reverse` is true, flips 0 and 1 anchors just like TradingView's "Reverse" setting.
 */
export function computeFibLevels(
  p1: number,
  p2: number,
  ratios: number[] = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1],
  reverse: boolean = false
): Array<{ ratio: number; price: number }> {
  const start = reverse ? p2 : p1;
  const end = reverse ? p1 : p2;
  return ratios.map((ratio) => ({
    ratio,
    price: end + (start - end) * ratio,
  }));
}

/**
 * Computes 3-point Trend-Based Fib Extension levels:
 * Trend wave p1 -> p2, projected from retracement point p3.
 */
export function computeFibExtensionLevels(
  p1: number,
  p2: number,
  p3: number,
  ratios: number[] = DEFAULT_FIB_EXTENSION_RATIOS,
  reverse: boolean = false
): Array<{ ratio: number; price: number }> {
  const delta = reverse ? p1 - p2 : p2 - p1;
  return ratios.map((ratio) => ({
    ratio,
    price: p3 + delta * ratio,
  }));
}

/**
 * Computes Fibonacci Time Zone timestamps starting at t1 with unit interval |t2 - t1|
 */
export function computeFibTimeZones(
  t1: number,
  t2: number,
  fibSeq: number[] = [0, 1, 2, 3, 5, 8, 13, 21]
): Array<{ fib: number; time: number }> {
  const unit = Math.max(60, Math.abs(t2 - t1));
  const dir = t2 >= t1 ? 1 : -1;
  return fibSeq.map((fib) => ({
    fib,
    time: t1 + dir * fib * unit,
  }));
}

/**
 * Computes exact TradingView 3-point Parallel Channel rails in pixel space.
 * Baseline runs p0 -> p1; parallel rail shifts vertically so it passes through p2.
 */
export function computeParallelChannelGeometry(
  p0: PixelPoint,
  p1: PixelPoint,
  p2?: PixelPoint | null
): {
  rail1Start: PixelPoint;
  rail1End: PixelPoint;
  rail2Start: PixelPoint;
  rail2End: PixelPoint;
  midStart: PixelPoint;
  midEnd: PixelPoint;
  offsetY: number;
} {
  if (!p2) {
    // Legacy 2-point horizontal channel fallback
    const topY = Math.min(p0.y, p1.y);
    const botY = Math.max(p0.y, p1.y);
    const leftX = Math.min(p0.x, p1.x);
    const rightX = Math.max(p0.x, p1.x);
    const midY = (topY + botY) / 2;
    return {
      rail1Start: { x: leftX, y: topY },
      rail1End: { x: rightX, y: topY },
      rail2Start: { x: leftX, y: botY },
      rail2End: { x: rightX, y: botY },
      midStart: { x: leftX, y: midY },
      midEnd: { x: rightX, y: midY },
      offsetY: botY - topY,
    };
  }

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const u = Math.abs(dx) > 1e-3 ? (p2.x - p0.x) / dx : 0.5;
  const lineYAtP2X = p0.y + u * dy;
  const offsetY = p2.y - lineYAtP2X;

  return {
    rail1Start: p0,
    rail1End: p1,
    rail2Start: { x: p0.x, y: p0.y + offsetY },
    rail2End: { x: p1.x, y: p1.y + offsetY },
    midStart: { x: p0.x, y: p0.y + offsetY / 2 },
    midEnd: { x: p1.x, y: p1.y + offsetY / 2 },
    offsetY,
  };
}

/**
 * Applies TradingView Shift-key constraint in pixel space:
 * - Trend / Ray / Info / Extended / Fib / Wave: 0° / 45° / 90° angle lock
 * - Rectangle / Circle / Measure / Ranges: 1:1 square / circle lock
 */
export function applyShiftConstraint(
  tool: DrawingToolId,
  anchorPx: PixelPoint,
  targetPx: PixelPoint
): PixelPoint {
  const dx = targetPx.x - anchorPx.x;
  const dy = targetPx.y - anchorPx.y;
  if (Math.hypot(dx, dy) < 2) return targetPx;

  if (
    tool === 'rectangle' ||
    tool === 'circle' ||
    tool === 'measure' ||
    tool === 'price-range' ||
    tool === 'date-range' ||
    tool === 'volume-profile'
  ) {
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return {
      x: anchorPx.x + (dx >= 0 ? side : -side),
      y: anchorPx.y + (dy >= 0 ? side : -side),
    };
  }

  // Snap to nearest 45-degree increment
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;
  const len = Math.hypot(dx, dy);
  return {
    x: anchorPx.x + Math.cos(snappedAngle) * len,
    y: anchorPx.y + Math.sin(snappedAngle) * len,
  };
}

/**
 * Computes Long/Short Position Risk-Reward metrics
 */
export function computePositionStats(
  side: 'long' | 'short',
  entry: number,
  target: number,
  stop: number
): PositionStats {
  const rewardPoints = side === 'long' ? target - entry : entry - target;
  const riskPoints = side === 'long' ? entry - stop : stop - entry;
  const safeRisk = Math.max(0.0001, Math.abs(riskPoints));
  const rewardPercent = entry !== 0 ? (rewardPoints / entry) * 100 : 0;
  const riskPercent = entry !== 0 ? (Math.abs(riskPoints) / entry) * 100 : 0;
  const riskRewardRatio = rewardPoints / safeRisk;
  return {
    entry,
    target,
    stop,
    rewardPoints,
    riskPoints: Math.abs(riskPoints),
    rewardPercent,
    riskPercent,
    riskRewardRatio,
  };
}

/**
 * Computes bar count, price delta, %, and duration for Info Line / Measure / Price Range
 */
export function computeMeasureStats(
  candles: CandleBar[],
  t1: number,
  p1: number,
  t2: number,
  p2: number,
  dxPx: number = 100,
  dyPx: number = 0
): MeasureStats {
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  const barsCount = candles.filter((c) => c.time >= tMin && c.time <= tMax).length;
  const diffSec = Math.abs(t2 - t1);
  let durationLabel = `${diffSec}s`;
  if (diffSec >= 86400) {
    durationLabel = `${Math.floor(diffSec / 86400)}d ${Math.floor((diffSec % 86400) / 3600)}h`;
  } else if (diffSec >= 3600) {
    durationLabel = `${Math.floor(diffSec / 3600)}h ${Math.floor((diffSec % 3600) / 60)}m`;
  } else if (diffSec >= 60) {
    durationLabel = `${Math.round(diffSec / 60)}m`;
  }
  const priceDiff = p2 - p1;
  const percentDiff = p1 !== 0 ? (priceDiff / p1) * 100 : 0;
  const angleDeg = (Math.atan2(-dyPx, dxPx) * 180) / Math.PI;
  return {
    priceDiff,
    percentDiff,
    barsCount,
    durationLabel,
    angleDeg,
  };
}

/**
 * Distance from point (px, py) to segment (x1, y1)-(x2, y2)
 */
export function distPointToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInTriangle(
  px: number,
  py: number,
  a: PixelPoint,
  b: PixelPoint,
  c: PixelPoint
): boolean {
  const d1 = (px - b.x) * (a.y - b.y) - (a.x - b.x) * (py - b.y);
  const d2 = (px - c.x) * (b.y - c.y) - (b.x - c.x) * (py - c.y);
  const d3 = (px - a.x) * (c.y - a.y) - (c.x - a.x) * (py - a.y);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function pointInPolygon(px: number, py: number, poly: PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Translates an entire drawing by (dt, dp) in data space
 */
export function translateDrawing(drawing: ChartDrawing, dt: number, dp: number): ChartDrawing {
  const nextPoints = drawing.points.map((pt) => ({
    t: Math.round(pt.t + dt),
    p: pt.p + dp,
  }));
  return {
    ...drawing,
    points: nextPoints,
    t1: nextPoints[0]?.t ?? drawing.t1 + dt,
    p1: nextPoints[0]?.p ?? drawing.p1 + dp,
    t2: nextPoints[1]?.t ?? drawing.t2 + dt,
    p2: nextPoints[1]?.p ?? drawing.p2 + dp,
  };
}

/**
 * Updates a single handle vertex of a drawing
 */
export function moveDrawingHandle(
  drawing: ChartDrawing,
  handleIndex: number,
  newPoint: DrawingPoint
): ChartDrawing {
  let nextPoints = [...drawing.points];

  if (drawing.tool === 'rectangle' && nextPoints.length >= 2 && handleIndex >= 2) {
    const p0 = { ...nextPoints[0] };
    const p1 = { ...nextPoints[1] };
    if (handleIndex === 2) {
      // Corner (p1.t, p0.p)
      p1.t = newPoint.t;
      p0.p = newPoint.p;
    } else if (handleIndex === 3) {
      // Corner (p0.t, p1.p)
      p0.t = newPoint.t;
      p1.p = newPoint.p;
    } else if (handleIndex === 4) {
      // Edge mid on p0.p
      p0.p = newPoint.p;
    } else if (handleIndex === 5) {
      // Edge mid on p1.p
      p1.p = newPoint.p;
    } else if (handleIndex === 6) {
      // Edge mid on p0.t
      p0.t = newPoint.t;
    } else if (handleIndex === 7) {
      // Edge mid on p1.t
      p1.t = newPoint.t;
    }
    nextPoints = [p0, p1];
  } else {
    nextPoints = drawing.points.map((pt, idx) =>
      idx === handleIndex ? { t: newPoint.t, p: newPoint.p } : pt
    );
  }

  // TradingView Long/Short Position: keep TP & SL right-edge timestamps synced when resizing right boundary
  if (
    (drawing.tool === 'long-position' || drawing.tool === 'short-position') &&
    (handleIndex === 1 || handleIndex === 2) &&
    nextPoints.length >= 3
  ) {
    const otherIdx = handleIndex === 1 ? 2 : 1;
    const rightT = Math.max(nextPoints[0].t + 60, newPoint.t);
    nextPoints = nextPoints.map((pt, idx) =>
      idx === handleIndex || idx === otherIdx ? { ...pt, t: rightT } : pt
    );
  }

  return {
    ...drawing,
    points: nextPoints,
    t1: nextPoints[0]?.t ?? drawing.t1,
    p1: nextPoints[0]?.p ?? drawing.p1,
    t2: nextPoints[1]?.t ?? drawing.t2,
    p2: nextPoints[1]?.p ?? drawing.p2,
  };
}

/**
 * Hit-tests all visible drawings in reverse render order (top-most first).
 * Returns the matched drawing ID and optional handle index.
 */
export function hitTestDrawings(
  drawings: ChartDrawing[],
  px: number,
  py: number,
  toCoords: CoordToPixelFn,
  canvasWidth: number = 1200,
  canvasHeight: number = 800,
  tolerance: number = 9
): HitTestResult | null {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (d.visible === false) continue;

    const pixelPts: PixelPoint[] = [];
    let valid = true;
    for (const pt of d.points) {
      const c = toCoords(pt.t, pt.p);
      if (c.x === null || c.y === null) {
        valid = false;
        break;
      }
      pixelPts.push({ x: c.x, y: c.y });
    }
    if (!valid || pixelPts.length === 0) continue;

    // 1. Check anchor handles first (for non-freehand tools; rectangles expose 8 resize handles)
    if (d.tool !== 'brush' && d.tool !== 'highlighter') {
      const handlesToCheck =
        d.tool === 'rectangle' && pixelPts.length >= 2
          ? getRectangleHandles(pixelPts[0], pixelPts[1])
          : pixelPts;
      for (let h = 0; h < handlesToCheck.length; h++) {
        const dist = Math.hypot(px - handlesToCheck[h].x, py - handlesToCheck[h].y);
        if (dist <= tolerance + 5) {
          return { drawingId: d.id, handleIndex: h };
        }
      }
    }

    const p0 = pixelPts[0];
    const p1 = pixelPts[1] ?? { x: p0.x + 140, y: p0.y };
    const p2 = pixelPts[2] ?? null;

    // 2. Check body hit per tool geometry
    if (d.tool === 'horizontal-line') {
      if (Math.abs(py - p0.y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'horizontal-ray') {
      if (Math.abs(py - p0.y) <= tolerance && px >= p0.x - tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'vertical-line') {
      if (Math.abs(px - p0.x) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'cross-line') {
      if (Math.abs(px - p0.x) <= tolerance || Math.abs(py - p0.y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'text-note' || d.tool === 'price-label') {
      const lines = (d.text || 'Note').split('\n');
      const maxChars = Math.max(8, ...lines.map((l) => l.length));
      const boxW = Math.max(96, maxChars * ((d.fontSize ?? 12) * 0.6) + 24);
      const boxH = Math.max(24, lines.length * ((d.fontSize ?? 12) + 5) + 10);
      if (d.tool === 'price-label') {
        if (px >= p0.x - 4 && px <= p0.x + boxW + 14 && py >= p0.y - 14 && py <= p0.y + 14) {
          return { drawingId: d.id, handleIndex: null };
        }
      } else if (px >= p0.x - 6 && px <= p0.x + boxW && py >= p0.y - boxH - 4 && py <= p0.y + 8) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'callout') {
      const lines = (d.text || 'Callout').split('\n');
      const maxChars = Math.max(8, ...lines.map((l) => l.length));
      const boxW = Math.max(100, maxChars * ((d.fontSize ?? 11.5) * 0.6) + 22);
      const boxH = Math.max(24, lines.length * ((d.fontSize ?? 11.5) + 5) + 10);
      if (
        distPointToSegment(px, py, p0.x, p0.y, p1.x, p1.y) <= tolerance ||
        (px >= p1.x - 14 && px <= p1.x + boxW && py >= p1.y - boxH - 6 && py <= p1.y + 8)
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'parallel-channel') {
      const ch = computeParallelChannelGeometry(p0, p1, p2);
      const swapRails =
        ch.rail1End.x < ch.rail1Start.x ||
        (Math.abs(ch.rail1End.x - ch.rail1Start.x) < 0.5 && ch.rail1End.y < ch.rail1Start.y);
      const r1L = swapRails ? ch.rail1End : ch.rail1Start;
      const r1R = swapRails ? ch.rail1Start : ch.rail1End;
      const r2L = swapRails ? ch.rail2End : ch.rail2Start;
      const r2R = swapRails ? ch.rail2Start : ch.rail2End;
      const mL = swapRails ? ch.midEnd : ch.midStart;
      const mR = swapRails ? ch.midStart : ch.midEnd;
      const extL = d.extendLeft ? Math.max(canvasWidth, canvasHeight) * 2.5 : 0;
      const extR = d.extendRight ? Math.max(canvasWidth, canvasHeight) * 2.5 : 0;
      const dx = r1R.x - r1L.x;
      const dy = r1R.y - r1L.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const r1a = { x: r1L.x - ux * extL, y: r1L.y - uy * extL };
      const r1b = { x: r1R.x + ux * extR, y: r1R.y + uy * extR };
      const r2a = { x: r2L.x - ux * extL, y: r2L.y - uy * extL };
      const r2b = { x: r2R.x + ux * extR, y: r2R.y + uy * extR };
      const ma = { x: mL.x - ux * extL, y: mL.y - uy * extL };
      const mb = { x: mR.x + ux * extR, y: mR.y + uy * extR };
      if (
        distPointToSegment(px, py, r1a.x, r1a.y, r1b.x, r1b.y) <= tolerance ||
        distPointToSegment(px, py, r2a.x, r2a.y, r2b.x, r2b.y) <= tolerance ||
        distPointToSegment(px, py, ma.x, ma.y, mb.x, mb.y) <= tolerance ||
        pointInPolygon(px, py, [r1a, r1b, r2b, r2a])
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'circle') {
      const cx = (p0.x + p1.x) / 2;
      const cy = (p0.y + p1.y) / 2;
      const rxE = Math.max(10, Math.abs(p1.x - p0.x) / 2);
      const ryE = Math.max(10, Math.abs(p1.y - p0.y) / 2);
      const normDist = ((px - cx) / (rxE + tolerance)) ** 2 + ((py - cy) / (ryE + tolerance)) ** 2;
      if (normDist <= 1.05) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'triangle') {
      const a = p2 ? p0 : { x: (p0.x + p1.x) / 2, y: p0.y };
      const b = p2 ? p1 : { x: p0.x, y: p1.y };
      const c = p2 ? p2 : { x: p1.x, y: p1.y };
      if (
        distPointToSegment(px, py, a.x, a.y, b.x, b.y) <= tolerance ||
        distPointToSegment(px, py, b.x, b.y, c.x, c.y) <= tolerance ||
        distPointToSegment(px, py, c.x, c.y, a.x, a.y) <= tolerance ||
        pointInTriangle(px, py, a, b, c)
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (
      d.tool === 'rectangle' ||
      d.tool === 'liquidity-box' ||
      d.tool === 'stop-channel' ||
      d.tool === 'fib-levels' ||
      d.tool === 'volume-profile' ||
      d.tool === 'measure' ||
      d.tool === 'price-range' ||
      d.tool === 'date-range' ||
      d.tool === 'candle-pattern'
    ) {
      const rx = Math.min(p0.x, p1.x);
      const ry = Math.min(p0.y, p1.y);
      const rw = Math.max(20, Math.abs(p1.x - p0.x));
      const rh = Math.max(14, Math.abs(p1.y - p0.y));
      const canExtendX = d.tool === 'fib-levels' || d.tool === 'rectangle';
      const extLeftPx = canExtendX && d.extendLeft ? 0 : rx - tolerance;
      const extRightPx = canExtendX && d.extendRight ? canvasWidth : rx + rw + tolerance;
      if (px >= extLeftPx && px <= extRightPx && py >= ry - tolerance && py <= ry + rh + tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'fib-extension') {
      const third = p2 ?? { x: p1.x + 80, y: p0.y };
      if (
        distPointToSegment(px, py, p0.x, p0.y, p1.x, p1.y) <= tolerance ||
        distPointToSegment(px, py, p1.x, p1.y, third.x, third.y) <= tolerance
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
      const extMinX = Math.min(p0.x, p1.x, third.x);
      const extMaxX = d.extendRight ? canvasWidth : Math.max(p0.x, p1.x, third.x) + 180;
      const ratios = d.fibRatios ?? DEFAULT_FIB_EXTENSION_RATIOS;
      const extLevels = computeFibExtensionLevels(
        d.points[0].p,
        d.points[1]?.p ?? d.points[0].p,
        d.points[2]?.p ?? d.points[0].p,
        ratios,
        d.reverseFib
      );
      if (px >= extMinX - tolerance && px <= extMaxX + tolerance) {
        for (const lvl of extLevels) {
          const coord = toCoords(d.points[0].t, lvl.price);
          if (coord.y !== null && Math.abs(py - coord.y) <= tolerance) {
            return { drawingId: d.id, handleIndex: null };
          }
        }
      }
      continue;
    }

    if (d.tool === 'pitchfork') {
      const third = p2 ?? { x: p1.x + 80, y: p0.y };
      const midX = (p1.x + third.x) / 2;
      const midY = (p1.y + third.y) / 2;
      const dx = midX - p0.x;
      const dy = midY - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = (dx / len) * canvasWidth * 2;
      const uy = (dy / len) * canvasWidth * 2;
      if (
        distPointToSegment(px, py, p1.x, p1.y, third.x, third.y) <= tolerance ||
        distPointToSegment(px, py, p0.x, p0.y, p0.x + ux, p0.y + uy) <= tolerance ||
        distPointToSegment(px, py, p1.x, p1.y, p1.x + ux, p1.y + uy) <= tolerance ||
        distPointToSegment(px, py, third.x, third.y, third.x + ux, third.y + uy) <= tolerance
      ) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'long-position' || d.tool === 'short-position') {
      const slPt = p2 ?? { x: p1.x, y: p0.y + (p0.y - p1.y) };
      const rx = p0.x;
      const rw = Math.max(128, Math.max(p1.x, slPt.x) - p0.x);
      const topY = Math.min(p0.y, p1.y, slPt.y);
      const botY = Math.max(p0.y, p1.y, slPt.y);
      if (px >= rx - tolerance && px <= rx + rw + tolerance && py >= topY - tolerance && py <= botY + tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (
      d.tool === 'ray' ||
      d.tool === 'extended-line' ||
      ((d.tool === 'trend-line' || d.tool === 'info-line') && (d.extendLeft || d.extendRight))
    ) {
      const span = Math.max(canvasWidth, canvasHeight) * 2.5;
      let startX = p0.x;
      let startY = p0.y;
      let endX = p1.x;
      let endY = p1.y;
      if (d.tool === 'ray') {
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        startX = d.extendLeft ? p0.x - ux * span : p0.x;
        startY = d.extendLeft ? p0.y - uy * span : p0.y;
        endX = p1.x + ux * span;
        endY = p1.y + uy * span;
      } else {
        const swap = p1.x < p0.x || (Math.abs(p1.x - p0.x) < 0.5 && p1.y < p0.y);
        const leftPt = swap ? p1 : p0;
        const rightPt = swap ? p0 : p1;
        const dx = rightPt.x - leftPt.x;
        const dy = rightPt.y - leftPt.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const extLeft = d.tool === 'extended-line' || Boolean(d.extendLeft);
        const extRight = d.tool === 'extended-line' || Boolean(d.extendRight);
        startX = extLeft ? leftPt.x - ux * span : leftPt.x;
        startY = extLeft ? leftPt.y - uy * span : leftPt.y;
        endX = extRight ? rightPt.x + ux * span : rightPt.x;
        endY = extRight ? rightPt.y + uy * span : rightPt.y;
      }
      if (distPointToSegment(px, py, startX, startY, endX, endY) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    if (d.tool === 'time-cycles') {
      const zones = computeFibTimeZones(d.points[0].t, d.points[1]?.t ?? d.points[0].t + 600);
      for (const z of zones) {
        const c = toCoords(z.time, d.points[0].p);
        if (c.x !== null && Math.abs(px - c.x) <= tolerance) {
          return { drawingId: d.id, handleIndex: null };
        }
      }
      if (distPointToSegment(px, py, p0.x, p0.y, p1.x, p1.y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
      continue;
    }

    // Multi-point segments (trend-line, info-line, wave-path, elliott-wave, brush, highlighter)
    for (let j = 0; j < pixelPts.length - 1; j++) {
      if (distPointToSegment(px, py, pixelPts[j].x, pixelPts[j].y, pixelPts[j + 1].x, pixelPts[j + 1].y) <= tolerance) {
        return { drawingId: d.id, handleIndex: null };
      }
    }
  }

  return null;
}

/**
 * Builds a complete default or click-placed ChartDrawing for any tool
 */
const DRAWING_TOOL_STYLE_STORAGE_KEY = 'tv_drawing_tool_styles_v1';

// Per-tool style memory: geometry, identity and text content are never remembered.
const NON_STYLE_FIELDS = new Set<string>([
  'id',
  'symbol',
  'tool',
  'title',
  'points',
  't1',
  'p1',
  't2',
  'p2',
  'text',
  'clonedBars',
  'locked',
  'visible',
  'visibleTimeframes',
]);

function readToolStyleStore(): Record<string, Partial<ChartDrawing>> {
  try {
    const raw = localStorage.getItem(DRAWING_TOOL_STYLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, Partial<ChartDrawing>>)
      : {};
  } catch {
    return {};
  }
}

export function extractDrawingStyle(drawing: ChartDrawing): Partial<ChartDrawing> {
  const style: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(drawing)) {
    if (NON_STYLE_FIELDS.has(key) || value === undefined) continue;
    style[key] = value;
  }
  return style as Partial<ChartDrawing>;
}

/** Persist a drawing's style so the next drawing made with the same tool starts from it. */
export function rememberDrawingToolStyle(drawing: ChartDrawing): void {
  try {
    const store = readToolStyleStore();
    store[drawing.tool] = extractDrawingStyle(drawing);
    localStorage.setItem(DRAWING_TOOL_STYLE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
}

/** Merge the last-used style for a tool over a freshly created drawing. */
export function applyRememberedToolStyle(drawing: ChartDrawing): ChartDrawing {
  const remembered = readToolStyleStore()[drawing.tool];
  if (!remembered) return drawing;
  return { ...drawing, ...remembered, id: drawing.id, points: drawing.points } as ChartDrawing;
}

export function createDrawingFromPoints(
  tool: DrawingToolId,
  symbol: string,
  points: DrawingPoint[],
  candles: CandleBar[],
  tickSize: number,
  decimals: number,
  color: string = '#2962ff'
): ChartDrawing {
  const p0 = points[0];
  let finalPoints = [...points];
  const barStepSec =
    candles.length >= 2
      ? Math.max(1, candles[candles.length - 1].time - candles[candles.length - 2].time)
      : 60;

  if (tool === 'long-position' || tool === 'short-position') {
    const step = Math.max(tickSize * 40, p0.p * 0.0009);
    const tWidth = Math.max(barStepSec * 14, 600);
    const tp =
      tool === 'long-position'
        ? roundToTick(p0.p + step * 2, tickSize, decimals)
        : roundToTick(p0.p - step * 2, tickSize, decimals);
    const sl =
      tool === 'long-position'
        ? roundToTick(p0.p - step, tickSize, decimals)
        : roundToTick(p0.p + step, tickSize, decimals);
    finalPoints = [
      { t: p0.t, p: p0.p },
      { t: p0.t + tWidth, p: tp },
      { t: p0.t + tWidth, p: sl },
    ];
  } else if (
    tool === 'horizontal-line' ||
    tool === 'horizontal-ray' ||
    tool === 'vertical-line' ||
    tool === 'cross-line' ||
    tool === 'text-note' ||
    tool === 'price-label'
  ) {
    const lastT = candles[candles.length - 1]?.time ?? p0.t + barStepSec * 20;
    finalPoints = [p0, { t: Math.max(p0.t + barStepSec * 10, lastT), p: p0.p }];
  } else if (tool === 'callout' && finalPoints.length === 1) {
    finalPoints = [
      p0,
      { t: p0.t + barStepSec * 8, p: roundToTick(p0.p + tickSize * 24, tickSize, decimals) },
    ];
  } else if (tool === 'parallel-channel' && finalPoints.length === 2) {
    finalPoints = [
      finalPoints[0],
      finalPoints[1],
      {
        t: finalPoints[0].t,
        p: roundToTick(finalPoints[0].p - tickSize * 25, tickSize, decimals),
      },
    ];
  } else if (tool === 'triangle' && finalPoints.length === 2) {
    finalPoints = [
      { t: Math.round((finalPoints[0].t + finalPoints[1].t) / 2), p: finalPoints[0].p },
      { t: finalPoints[0].t, p: finalPoints[1].p },
      { t: finalPoints[1].t, p: finalPoints[1].p },
    ];
  } else if (finalPoints.length >= 2) {
    // Ensure non-zero span if user clicked twice in same pixel
    if (finalPoints[1].t === finalPoints[0].t && finalPoints[1].p === finalPoints[0].p) {
      finalPoints[1] = {
        t: finalPoints[0].t + barStepSec * 12,
        p: roundToTick(finalPoints[0].p - tickSize * 20, tickSize, decimals),
      };
    }
  }

  let clonedBars: ChartDrawing['clonedBars'];
  if (tool === 'candle-pattern' && finalPoints.length >= 2) {
    const tMin = Math.min(finalPoints[0].t, finalPoints[1].t);
    const tMax = Math.max(finalPoints[0].t, finalPoints[1].t);
    const slice = candles.filter((c) => c.time >= tMin && c.time <= tMax).slice(0, 32);
    if (slice.length > 0) {
      const baseOpen = slice[0].open;
      clonedBars = slice.map((b) => ({
        openOffset: b.open - baseOpen,
        highOffset: b.high - baseOpen,
        lowOffset: b.low - baseOpen,
        closeOffset: b.close - baseOpen,
      }));
    }
  }

  const defaultColor =
    tool === 'stop-channel'
      ? '#f23645'
      : tool === 'rectangle'
      ? '#089981'
      : tool === 'highlighter'
      ? '#ffeb3b'
      : color;

  const drawing: ChartDrawing = {
    id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol,
    tool,
    points: finalPoints,
    t1: finalPoints[0].t,
    p1: finalPoints[0].p,
    t2: finalPoints[1]?.t ?? finalPoints[0].t + 900,
    p2: finalPoints[1]?.p ?? finalPoints[0].p,
    text:
      tool === 'text-note'
        ? 'Institutional Note'
        : tool === 'callout'
        ? 'Liquidity Sweep'
        : tool === 'price-label'
        ? `${p0.p.toFixed(decimals)}`
        : undefined,
    showText: true,
    textColor: defaultColor,
    textBold: false,
    textItalic: false,
    textAlignH: tool === 'rectangle' || tool === 'circle' || tool === 'parallel-channel' ? 'center' : 'center',
    textAlignV: tool === 'rectangle' || tool === 'circle' || tool === 'parallel-channel' ? 'middle' : 'top',
    textOrientation: 'along',
    color: defaultColor,
    showBorder: true,
    borderOpacity: 1,
    fillColor: defaultColor,
    showFill: true,
    lineWidth: tool === 'highlighter' ? 12 : 1.8,
    lineStyle: tool === 'vertical-line' ? 'dashed' : 'solid',
    fontSize: 12,
    fillOpacity: 0.16,
    showMidline: tool === 'parallel-channel' || tool === 'rectangle',
    midlineColor: defaultColor,
    midlineOpacity: 0.75,
    midlineStyle: tool === 'rectangle' ? 'dotted' : 'dashed',
    midlineWidth: 1,
    angleSnap: false,
    leftEnd: 'normal',
    rightEnd: 'normal',
    showLabels: true,
    fibRatios:
      tool === 'fib-levels'
        ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
        : tool === 'fib-extension'
        ? [...DEFAULT_FIB_EXTENSION_RATIOS]
        : undefined,
    reverseFib: false,
    accountSize: tool === 'long-position' || tool === 'short-position' ? 100000 : undefined,
    riskPct: tool === 'long-position' || tool === 'short-position' ? 1 : undefined,
    locked: false,
    visible: true,
    clonedBars,
  };

  return applyRememberedToolStyle(drawing);
}
