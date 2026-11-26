import { CandleBar } from './marketEngine.ts';
import { OrderflowBarPoint } from '../types/trading.ts';

export interface OrderflowSummary {
  latestDelta: number;
  latestCvd: number;
  buyPct: number;
  totalVolume: number;
  bullAbsorptions: number;
  bearAbsorptions: number;
  latestAbsorption: { time: number; type: 'bull' | 'bear'; strength: number } | null;
  divergences: number;
}

/**
 * Computes institutional Bar Orderflow (Buy Volume, Sell Volume, Bar Delta, Cumulative Volume Delta)
 * and passive Absorption Delta signals from OHLCV candles plus optional real-time WebSocket tick deltas.
 */
export function computeBarOrderflow(
  candles: CandleBar[],
  liveTickDeltas?: Record<number, number>
): OrderflowBarPoint[] {
  if (!candles || candles.length === 0) return [];

  const points: OrderflowBarPoint[] = [];
  let cvd = 0;

  // Pass 1: Decompose per-bar volume into aggressive buy/sell flow & delta
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const vol = Math.max(0, Number.isFinite(c.volume) ? c.volume : 0);
    const range = Math.max(0, c.high - c.low);

    let buyRatio = 0.5;
    if (range > 1e-9) {
      // Combine Close Location Value (CLV) with open-to-close body direction
      const clv = Math.min(1, Math.max(0, (c.close - c.low) / range));
      const bodyFrac = Math.min(1, Math.max(-1, (c.close - c.open) / range));
      const bodyRatio = 0.5 + 0.5 * bodyFrac;
      buyRatio = 0.65 * clv + 0.35 * bodyRatio;
    } else if (c.close > prevClose) {
      buyRatio = 0.72;
    } else if (c.close < prevClose) {
      buyRatio = 0.28;
    }

    let delta = vol * (2 * buyRatio - 1);

    // Blend in true real-time WebSocket uptick/downtick signed volume if captured for this candle
    const tickDelta = liveTickDeltas?.[c.time];
    if (tickDelta !== undefined && Number.isFinite(tickDelta) && vol > 0) {
      const clampedTick = Math.max(-vol, Math.min(vol, tickDelta));
      delta = 0.65 * clampedTick + 0.35 * delta;
    }

    const buyVolume = Math.max(0, Math.min(vol, (vol + delta) / 2));
    const sellVolume = Math.max(0, vol - buyVolume);
    delta = buyVolume - sellVolume;
    const deltaPct = vol > 0 ? delta / vol : 0;
    cvd += delta;

    points.push({
      time: c.time,
      volume: vol,
      buyVolume,
      sellVolume,
      delta,
      deltaPct,
      cvd,
      absorption: null,
      absorptionStrength: 0,
      divergence: null,
      high: c.high,
      low: c.low,
      close: c.close,
    });
  }

  // Pass 2: Detect Absorption Delta (high volume & directional effort with trapped/rejected price progress)
  const lookback = 20;
  for (let i = 3; i < points.length; i++) {
    const start = Math.max(0, i - lookback);
    let volSum = 0;
    let absDeltaSum = 0;
    let rangeSum = 0;
    const count = i - start;

    for (let j = start; j < i; j++) {
      volSum += points[j].volume;
      absDeltaSum += Math.abs(points[j].delta);
      rangeSum += Math.max(0, candles[j].high - candles[j].low);
    }

    const avgVol = count > 0 ? volSum / count : 0;
    const avgAbsDelta = count > 0 ? absDeltaSum / count : 0;
    const avgRange = count > 0 ? rangeSum / count : 0;

    const pt = points[i];
    const bar = candles[i];
    const barRange = Math.max(0, bar.high - bar.low);
    const body = Math.abs(bar.close - bar.open);
    const lowerWick = Math.min(bar.open, bar.close) - bar.low;
    const upperWick = bar.high - Math.max(bar.open, bar.close);

    if (pt.volume <= 0 || avgVol <= 0 || barRange <= 1e-9) continue;

    const volRatio = pt.volume / avgVol;
    const deltaRatio = avgAbsDelta > 0 ? Math.abs(pt.delta) / avgAbsDelta : 0;
    const bodyPct = body / barRange;
    const lowerWickPct = lowerWick / barRange;
    const upperWickPct = upperWick / barRange;
    const closePos = (bar.close - bar.low) / barRange;
    const isCompressedRange = avgRange > 0 ? barRange <= avgRange * 1.15 : true;

    const heavyFlow = volRatio >= 1.35 && (deltaRatio >= 0.85 || Math.abs(pt.deltaPct) >= 0.24);
    if (!heavyFlow) continue;

    // Bullish Passive Bid Absorption:
    // Heavy aggressive selling fails to break lower -> long lower wick rejection OR tight-body close near upper half
    const isBullBidAbsorb =
      (pt.delta < 0 && (lowerWickPct >= 0.42 || (bodyPct <= 0.36 && isCompressedRange && closePos >= 0.45))) ||
      (volRatio >= 1.65 && lowerWickPct >= 0.5 && closePos >= 0.62);

    // Bearish Passive Ask Absorption:
    // Heavy aggressive buying fails to expand higher -> long upper wick rejection OR tight-body close near lower half
    const isBearAskAbsorb =
      (pt.delta > 0 && (upperWickPct >= 0.42 || (bodyPct <= 0.36 && isCompressedRange && closePos <= 0.55))) ||
      (volRatio >= 1.65 && upperWickPct >= 0.5 && closePos <= 0.38);

    if (isBullBidAbsorb && !isBearAskAbsorb) {
      pt.absorption = 'bull';
      pt.absorptionStrength = Number(Math.min(4, volRatio * (1 + Math.max(0, lowerWickPct - 0.25))).toFixed(2));
    } else if (isBearAskAbsorb && !isBullBidAbsorb) {
      pt.absorption = 'bear';
      pt.absorptionStrength = Number(Math.min(4, volRatio * (1 + Math.max(0, upperWickPct - 0.25))).toFixed(2));
    } else if (isBullBidAbsorb && isBearAskAbsorb) {
      pt.absorption = pt.delta < 0 ? 'bull' : 'bear';
      pt.absorptionStrength = Number(Math.min(4, volRatio).toFixed(2));
    }
  }

  // Pass 3: Detect local Price vs CVD Divergences over 8-bar swing windows
  const divLookback = 8;
  for (let i = divLookback * 2; i < points.length; i++) {
    const cur = points[i];
    const prev = points[i - divLookback];
    // Confirm local pivot low or high inside trailing 3 bars
    const isLocalLow =
      cur.low <= points[i - 1].low && cur.low <= points[i - 2].low && prev.low < points[i - 1].low;
    const isLocalHigh =
      cur.high >= points[i - 1].high && cur.high >= points[i - 2].high && prev.high > points[i - 1].high;

    if (isLocalLow && cur.low < prev.low && cur.cvd > prev.cvd) {
      cur.divergence = 'bull_div';
    } else if (isLocalHigh && cur.high > prev.high && cur.cvd < prev.cvd) {
      cur.divergence = 'bear_div';
    }
  }

  return points;
}

export function summarizeOrderflow(points: OrderflowBarPoint[]): OrderflowSummary {
  if (points.length === 0) {
    return {
      latestDelta: 0,
      latestCvd: 0,
      buyPct: 50,
      totalVolume: 0,
      bullAbsorptions: 0,
      bearAbsorptions: 0,
      latestAbsorption: null,
      divergences: 0,
    };
  }

  let totalBuy = 0;
  let totalVol = 0;
  let bullAbs = 0;
  let bearAbs = 0;
  let divs = 0;
  let latestAbs: { time: number; type: 'bull' | 'bear'; strength: number } | null = null;

  for (const pt of points) {
    totalBuy += pt.buyVolume;
    totalVol += pt.volume;
    if (pt.absorption === 'bull') {
      bullAbs++;
      latestAbs = { time: pt.time, type: 'bull', strength: pt.absorptionStrength };
    } else if (pt.absorption === 'bear') {
      bearAbs++;
      latestAbs = { time: pt.time, type: 'bear', strength: pt.absorptionStrength };
    }
    if (pt.divergence) divs++;
  }

  const last = points[points.length - 1];
  return {
    latestDelta: last.delta,
    latestCvd: last.cvd,
    buyPct: totalVol > 0 ? Number(((totalBuy / totalVol) * 100).toFixed(1)) : 50,
    totalVolume: totalVol,
    bullAbsorptions: bullAbs,
    bearAbsorptions: bearAbs,
    latestAbsorption: latestAbs,
    divergences: divs,
  };
}
