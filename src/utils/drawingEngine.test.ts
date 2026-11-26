import test from 'node:test';
import assert from 'node:assert/strict';
import { CandleBar, INITIAL_SYMBOLS } from './marketEngine';
import {
  getToolPointMode,
  snapPriceToCandle,
  computeVolumeProfile,
  computeFibLevels,
  computeFibExtensionLevels,
  computeFibTimeZones,
  computeParallelChannelGeometry,
  applyShiftConstraint,
  computePositionStats,
  computeMeasureStats,
  hitTestDrawings,
  translateDrawing,
  moveDrawingHandle,
  createDrawingFromPoints,
  getRectangleHandles,
  isLineToolId,
  supportsAngleSnapTool,
  supportsRichTextTool,
} from './drawingEngine';

function makeTestCandles(count: number, startPrice: number = 25000): CandleBar[] {
  const baseTime = 1763000040;
  return Array.from({ length: count }, (_, idx) => {
    const open = startPrice + idx * 1.5;
    const close = open + (idx % 2 === 0 ? 2 : -1);
    const high = Math.max(open, close) + 1.25;
    const low = Math.min(open, close) - 1.25;
    return {
      time: baseTime + idx * 60,
      open,
      high,
      low,
      close,
      volume: 150 + idx * 10,
    };
  });
}

test('getToolPointMode categorizes 1-point, 2-point, 3-point, multi, and freehand tools', () => {
  assert.equal(getToolPointMode('horizontal-line'), 1);
  assert.equal(getToolPointMode('long-position'), 1);
  assert.equal(getToolPointMode('trend-line'), 2);
  assert.equal(getToolPointMode('pitchfork'), 3);
  assert.equal(getToolPointMode('parallel-channel'), 3);
  assert.equal(getToolPointMode('triangle'), 3);
  assert.equal(getToolPointMode('fib-extension'), 3);
  assert.equal(getToolPointMode('wave-path'), 'multi');
  assert.equal(getToolPointMode('brush'), 'freehand');
});

test('snapPriceToCandle snaps to nearest OHLC when magnet is enabled', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(40, 25000);
  const last = candles[candles.length - 1];
  const snapped = snapPriceToCandle(candles, last.time, last.high + 0.1, true, nq.tickSize, nq.decimals);
  assert.equal(snapped, last.high);

  const unsnapped = snapPriceToCandle(candles, last.time, 25050.12, false, nq.tickSize, nq.decimals);
  assert.equal(unsnapped, 25050.00);
});

test('computeVolumeProfile aggregates real candle volume and finds POC', () => {
  const candles = makeTestCandles(60, 25000);
  const t1 = candles[10].time;
  const t2 = candles[40].time;
  const low = Math.min(...candles.slice(10, 41).map((c) => c.low));
  const high = Math.max(...candles.slice(10, 41).map((c) => c.high));

  const profile = computeVolumeProfile(candles, t1, t2, low, high, 10);
  assert.equal(profile.rows.length, 10);
  assert.ok(profile.totalVolume > 0);
  assert.equal(profile.rows.filter((r) => r.isPOC).length, 1);
  assert.ok(profile.pocPrice >= low && profile.pocPrice <= high);
});

test('computeFibLevels, computeFibExtensionLevels, and computeFibTimeZones calculate accurate ratios', () => {
  const levels = computeFibLevels(25400, 25300, [0, 0.5, 1]);
  assert.equal(levels[0].price, 25300);
  assert.equal(levels[1].price, 25350);
  assert.equal(levels[2].price, 25400);

  const revLevels = computeFibLevels(25400, 25300, [0, 0.5, 1], true);
  assert.equal(revLevels[0].price, 25400);
  assert.equal(revLevels[2].price, 25300);

  const ext = computeFibExtensionLevels(100, 200, 150, [0, 0.618, 1, 1.618]);
  assert.equal(ext[0].price, 150);
  assert.equal(ext[1].price, 211.8);
  assert.equal(ext[2].price, 250);
  assert.equal(ext[3].price, 311.8);

  const zones = computeFibTimeZones(1000, 1060, [0, 1, 2, 3, 5]);
  assert.deepEqual(
    zones.map((z) => z.time),
    [1000, 1060, 1120, 1180, 1300]
  );
});

test('computePositionStats calculates R:R ratio accurately for Long and Short', () => {
  const longStats = computePositionStats('long', 25300, 25360, 25280);
  assert.equal(longStats.rewardPoints, 60);
  assert.equal(longStats.riskPoints, 20);
  assert.equal(longStats.riskRewardRatio, 3);

  const shortStats = computePositionStats('short', 25300, 25240, 25330);
  assert.equal(shortStats.rewardPoints, 60);
  assert.equal(shortStats.riskPoints, 30);
  assert.equal(shortStats.riskRewardRatio, 2);
});

test('hitTestDrawings, translateDrawing, and moveDrawingHandle operate accurately', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const drawing = createDrawingFromPoints(
    'trend-line',
    'NASDAQ100',
    [
      { t: 100, p: 25300 },
      { t: 200, p: 25350 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );

  // Simple identity mapper for testing
  const toCoords = (t: number, p: number) => ({ x: t, y: 25400 - p });

  // Handle 0 hit at (100, 100)
  const h0 = hitTestDrawings([drawing], 101, 99, toCoords);
  assert.deepEqual(h0, { drawingId: drawing.id, handleIndex: 0 });

  // Body hit along midpoint (150, 75)
  const body = hitTestDrawings([drawing], 150, 75, toCoords);
  assert.deepEqual(body, { drawingId: drawing.id, handleIndex: null });

  // Miss far away
  const miss = hitTestDrawings([drawing], 500, 500, toCoords);
  assert.equal(miss, null);

  // Translate drawing
  const moved = translateDrawing(drawing, 60, 10);
  assert.equal(moved.t1, 160);
  assert.equal(moved.p1, 25310);
  assert.equal(moved.t2, 260);
  assert.equal(moved.p2, 25360);

  // Move single handle
  const reshaped = moveDrawingHandle(moved, 1, { t: 300, p: 25400 });
  assert.equal(reshaped.t2, 300);
  assert.equal(reshaped.p2, 25400);

  // Measure stats
  const m = computeMeasureStats(candles, candles[0].time, 25300, candles[9].time, 25350);
  assert.equal(m.barsCount, 10);
  assert.equal(m.priceDiff, 50);
});

test('3-point Parallel Channel, Triangle, and Shift constraint geometry behave like TradingView', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const toCoords = (t: number, p: number) => ({ x: t, y: 25400 - p });

  const chGeom = computeParallelChannelGeometry({ x: 100, y: 100 }, { x: 200, y: 50 }, { x: 150, y: 125 });
  assert.equal(chGeom.offsetY, 50);
  assert.equal(chGeom.rail2Start.y, 150);
  assert.equal(chGeom.rail2End.y, 100);

  const ch = createDrawingFromPoints(
    'parallel-channel',
    'NASDAQ100',
    [
      { t: 100, p: 25300 },
      { t: 200, p: 25350 },
      { t: 150, p: 25275 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );
  // Interior of sloped channel at (150, 100) should hit body
  const chHit = hitTestDrawings([ch], 150, 100, toCoords);
  assert.deepEqual(chHit, { drawingId: ch.id, handleIndex: null });

  const tri = createDrawingFromPoints(
    'triangle',
    'NASDAQ100',
    [
      { t: 100, p: 25300 },
      { t: 200, p: 25300 },
      { t: 150, p: 25360 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );
  // Interior of triangle at (150, 80) should hit body
  const triHit = hitTestDrawings([tri], 150, 80, toCoords);
  assert.deepEqual(triHit, { drawingId: tri.id, handleIndex: null });

  // Shift constraint squares a rectangle and snaps trend line near 0 deg
  const sq = applyShiftConstraint('rectangle', { x: 100, y: 100 }, { x: 160, y: 125 });
  assert.equal(sq.x, 160);
  assert.equal(sq.y, 160);

  const flatLine = applyShiftConstraint('trend-line', { x: 100, y: 100 }, { x: 200, y: 105 });
  assert.ok(Math.abs(flatLine.y - 100) < 0.001);
});

test('right future whitespace does not snap Y to historical bar and keeps right-extending points valid', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const last = candles[candles.length - 1];
  const futureTime = last.time + 60 * 10; // 10 bars to the right of last bar

  // Magnet should NOT snap back to historical candle when >1.5 bars into right future margin
  const freePrice = snapPriceToCandle(candles, futureTime, 25200.25, true, nq.tickSize, nq.decimals);
  assert.equal(freePrice, 25200.25);

  const pos = createDrawingFromPoints(
    'long-position',
    'NASDAQ100',
    [{ t: last.time, p: last.close }],
    candles,
    nq.tickSize,
    nq.decimals
  );
  assert.ok(pos.points[1].t > pos.points[0].t, 'Long position target handle extends right of entry');
  assert.ok(pos.points[2].t > pos.points[0].t, 'Long position stop handle extends right of entry');
  assert.ok(pos.points[0].t > 0 && pos.points[1].t > 0, 'Timestamps are positive and never zero');
});

test('8-handle rectangle editing, extend-right hit-testing, and tool capability helpers work accurately', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const toCoords = (t: number, p: number) => ({ x: t, y: 25400 - p });

  assert.equal(isLineToolId('trend-line'), true);
  assert.equal(isLineToolId('horizontal-line'), true);
  assert.equal(isLineToolId('rectangle'), false);

  assert.equal(supportsAngleSnapTool('trend-line'), true);
  assert.equal(supportsAngleSnapTool('rectangle'), true);
  assert.equal(supportsAngleSnapTool('long-position'), false);

  assert.equal(supportsRichTextTool('trend-line'), true);
  assert.equal(supportsRichTextTool('rectangle'), true);
  assert.equal(supportsRichTextTool('fib-levels'), false);

  const handles = getRectangleHandles({ x: 100, y: 100 }, { x: 200, y: 200 });
  assert.equal(handles.length, 8);
  assert.deepEqual(handles[2], { x: 200, y: 100 });
  assert.deepEqual(handles[3], { x: 100, y: 200 });
  assert.deepEqual(handles[4], { x: 150, y: 100 });
  assert.deepEqual(handles[7], { x: 200, y: 150 });

  const rect = createDrawingFromPoints(
    'rectangle',
    'NASDAQ100',
    [
      { t: 100, p: 25300 }, // y=100
      { t: 200, p: 25200 }, // y=200
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );

  // Mid-right edge handle (index 7 at x=200, y=150) should be hit
  const h7 = hitTestDrawings([rect], 201, 150, toCoords, 1200, 800);
  assert.deepEqual(h7, { drawingId: rect.id, handleIndex: 7 });

  // Resizing handle 7 updates p1.t only
  const resizedEdge = moveDrawingHandle(rect, 7, { t: 260, p: 25250 });
  assert.equal(resizedEdge.points[1].t, 260);
  assert.equal(resizedEdge.points[1].p, 25200);

  // Resizing top-right corner handle 2 updates p1.t and p0.p
  const resizedCorner = moveDrawingHandle(rect, 2, { t: 280, p: 25340 });
  assert.equal(resizedCorner.points[1].t, 280);
  assert.equal(resizedCorner.points[0].p, 25340);

  // Rectangle with extendRight should hit to the right of p1.t (x=450)
  const extRect = { ...rect, extendRight: true };
  const extHit = hitTestDrawings([extRect], 450, 150, toCoords, 1200, 800);
  assert.deepEqual(extHit, { drawingId: rect.id, handleIndex: null });
});

test('right-to-left extended trend lines and channels extend toward the proper visual left/right directions', () => {
  const nq = INITIAL_SYMBOLS[0];
  const candles = makeTestCandles(30, 25000);
  const toCoords = (t: number, p: number) => ({ x: t, y: 25400 - p });

  // Drawn right-to-left: p0 at x=300, p1 at x=200 (horizontal line at p=25300 => y=100)
  const rtlTrend = createDrawingFromPoints(
    'trend-line',
    'NASDAQ100',
    [
      { t: 300, p: 25300 },
      { t: 200, p: 25300 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );
  rtlTrend.extendRight = true;

  // Should hit to the right of x=300 (x=650), and NOT to the left of x=200 (x=50)
  const rightHit = hitTestDrawings([rtlTrend], 650, 100, toCoords, 1200, 800);
  assert.deepEqual(rightHit, { drawingId: rtlTrend.id, handleIndex: null });
  const leftMiss = hitTestDrawings([rtlTrend], 50, 100, toCoords, 1200, 800);
  assert.equal(leftMiss, null);

  const rtlChannel = createDrawingFromPoints(
    'parallel-channel',
    'NASDAQ100',
    [
      { t: 300, p: 25300 },
      { t: 200, p: 25300 },
      { t: 250, p: 25250 },
    ],
    candles,
    nq.tickSize,
    nq.decimals
  );
  rtlChannel.extendLeft = true;

  // Should hit to the left of x=200 (x=60, y=125), and NOT to the right of x=300 (x=600, y=125)
  const chLeftHit = hitTestDrawings([rtlChannel], 60, 125, toCoords, 1200, 800);
  assert.deepEqual(chLeftHit, { drawingId: rtlChannel.id, handleIndex: null });
  const chRightMiss = hitTestDrawings([rtlChannel], 600, 125, toCoords, 1200, 800);
  assert.equal(chRightMiss, null);
});

