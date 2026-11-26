import {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  ITimeScaleApi,
  Logical,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import {
  CandleBar,
  IVWallLevel,
  SupplyDemandZone,
  SymbolInfo,
  formatPrice,
} from '../utils/marketEngine';
import {
  ChartDrawing,
  DEFAULT_VOLUME_PROFILE_CONFIG,
  GexStrikeLevel,
  OrderflowBarPoint,
  VolumeProfileConfig,
} from '../types/trading';
import {
  DEFAULT_FIB_EXTENSION_RATIOS,
  VolumeProfileResult,
  computeFibExtensionLevels,
  computeFibLevels,
  computeFibTimeZones,
  computeMeasureStats,
  computeParallelChannelGeometry,
  computePositionStats,
  computeVolumeProfile,
  getRectangleHandles,
} from '../utils/drawingEngine';

export interface LiveDrawingPreviewState {
  drawing: ChartDrawing | null;
  isGhost?: boolean;
  snapPixel?: { x: number; y: number } | null;
}

export interface ChartOverlaysState {
  candles: CandleBar[];
  candleIntervalSec: number;
  symbolInfo: SymbolInfo;
  isLight: boolean;
  ssmtVisible: boolean;
  ivWallsVisible: boolean;
  supplyDemandZones: SupplyDemandZone[];
  ivWalls: IVWallLevel[];
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  hoveredDrawingId: string | null;
  gexStrikes?: GexStrikeLevel[];
  gexShowHistogram?: boolean;
  gexSpotScaleRatio?: number;
  gexExpectedMove?: { upper: number; lower: number } | null;
  absorptionVisible?: boolean;
  orderflowPoints?: OrderflowBarPoint[];
  volumeProfileVisible?: boolean;
  volumeProfileConfig?: VolumeProfileConfig;
  volumeProfileData?: VolumeProfileResult | null;
}

/**
 * Converts any Unix timestamp (in-series, gap-interior, or future/past offset) into
 * an exact X coordinate using LightweightCharts' live timeScale transform.
 */
export function timeToChartX(
  ts: ITimeScaleApi<Time>,
  candles: CandleBar[],
  candleIntervalSec: number,
  timeSec: number
): number | null {
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;

  const direct = ts.timeToCoordinate(timeSec as Time);
  if (direct !== null && direct !== undefined && Number.isFinite(Number(direct))) {
    return Number(direct);
  }
  if (candles.length === 0) return null;

  const safeInterval = Math.max(1, candleIntervalSec);
  const lastIdx = candles.length - 1;
  const firstTime = candles[0].time;
  const lastTime = candles[lastIdx].time;

  let logical: number;
  if (candles.length === 1 || timeSec <= firstTime) {
    logical = (timeSec - firstTime) / safeInterval;
  } else if (timeSec >= lastTime) {
    logical = lastIdx + (timeSec - lastTime) / safeInterval;
  } else {
    // Binary search for surrounding candles [lo, lo + 1]
    let lo = 0;
    let hi = lastIdx - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (candles[mid].time <= timeSec) lo = mid;
      else hi = mid - 1;
    }
    const t0 = candles[lo].time;
    const t1 = candles[lo + 1]?.time ?? t0 + safeInterval;
    const span = Math.max(1, t1 - t0);
    logical = lo + (timeSec - t0) / span;
  }

  const coord = ts.logicalToCoordinate(logical as Logical);
  if (coord !== null && coord !== undefined && Number.isFinite(Number(coord))) {
    return Number(coord);
  }

  // Fallback linear extrapolation using visible logical range so points far right/left stay positioned properly
  const visRange = ts.getVisibleLogicalRange();
  const chartW = ts.width();
  if (visRange && chartW > 0 && visRange.to > visRange.from) {
    const pxPerBar = chartW / (visRange.to - visRange.from);
    return (logical - visRange.from) * pxPerBar;
  }
  return null;
}

function getDashPattern(style?: 'solid' | 'dashed' | 'dotted'): number[] {
  if (style === 'dashed') return [6, 4];
  if (style === 'dotted') return [2, 3];
  return [];
}

function hexToRgba(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const c = color.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((ch) => ch + ch)
        .join('');
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
      }
    }
  }
  return c;
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  size: number = 7
) {
  const angle = Math.atan2(toY - fromY, toX - fromX);
  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle - Math.PI / 6), toY - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - size * Math.cos(angle + Math.PI / 6), toY - size * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawHandlesCanvas(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  isSelected: boolean,
  color: string
) {
  const r = isSelected ? 5 : 4;
  for (const pt of points) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isSelected ? '#2962ff' : color;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();
  }
}

function drawRectangleHandlesCanvas(
  ctx: CanvasRenderingContext2D,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  isSelected: boolean,
  color: string
) {
  const handles = getRectangleHandles(p0, p1);
  const strokeCol = isSelected ? '#2962ff' : color;
  const r = isSelected ? 5.5 : 4.5;
  for (let idx = 0; idx < handles.length; idx++) {
    const pt = handles[idx];
    ctx.save();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2.2;
    if (idx < 4) {
      // 4 corner circular handles
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // 4 edge-midpoint rounded-square handles
      const sz = r * 1.9;
      drawRoundedRect(ctx, pt.x - sz / 2, pt.y - sz / 2, sz, sz, 2.5);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function buildDrawingFont(d: ChartDrawing, fallbackSize: number = 12): string {
  const fSize = d.fontSize ?? fallbackSize;
  const weight = d.textBold ? '700' : '500';
  const style = d.textItalic ? 'italic ' : '';
  return `${style}${weight} ${fSize}px "Plus Jakarta Sans", sans-serif`;
}

function splitWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  wrap: boolean
): string[] {
  const rawLines = text.split('\n');
  if (!wrap || maxWidth < 36) return rawLines;
  const out: string[] = [];
  for (const para of rawLines) {
    if (!para) {
      out.push('');
      continue;
    }
    const words = para.split(' ');
    let cur = '';
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxWidth) {
        cur = candidate;
      } else {
        if (cur) out.push(cur);
        cur = w;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

function drawBoxRichText(
  ctx: CanvasRenderingContext2D,
  d: ChartDrawing,
  boxLeft: number,
  boxTop: number,
  boxWidth: number,
  boxHeight: number,
  isLight: boolean,
  defaultAlignV: 'top' | 'middle' | 'bottom' = 'middle'
) {
  if (d.showText === false || !d.text || d.text.trim().length === 0) return;
  const fSize = d.fontSize ?? 12;
  const alignH = d.textAlignH ?? 'center';
  const alignV = d.textAlignV ?? defaultAlignV;
  const lineH = Math.round(fSize * 1.32);

  ctx.save();
  ctx.font = buildDrawingFont(d, 12);
  ctx.fillStyle = d.textColor || d.color || (isLight ? '#131722' : '#ffffff');
  ctx.textBaseline = 'middle';

  const padX = 10;
  const padY = 8;
  const lines = splitWrappedLines(ctx, d.text, Math.max(40, boxWidth - padX * 2), Boolean(d.textWrap));
  const totalH = lines.length * lineH;

  let textX = boxLeft + boxWidth / 2;
  if (alignH === 'left') {
    textX = boxLeft + padX;
    ctx.textAlign = 'left';
  } else if (alignH === 'right') {
    textX = boxLeft + boxWidth - padX;
    ctx.textAlign = 'right';
  } else {
    ctx.textAlign = 'center';
  }

  let firstLineCenterY = boxTop + boxHeight / 2 - (totalH - lineH) / 2;
  if (alignV === 'top') {
    firstLineCenterY = boxTop + padY + lineH / 2;
  } else if (alignV === 'bottom') {
    firstLineCenterY = boxTop + boxHeight - padY - totalH + lineH / 2;
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX, firstLineCenterY + i * lineH);
  }
  ctx.restore();
}

function clipLineSegmentToRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const checks: Array<[number, number]> = [
    [-dx, a.x - minX],
    [dx, maxX - a.x],
    [-dy, a.y - minY],
    [dy, maxY - a.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-6) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  if (t0 > t1) return null;
  return {
    start: { x: a.x + t0 * dx, y: a.y + t0 * dy },
    end: { x: a.x + t1 * dx, y: a.y + t1 * dy },
  };
}

function drawLineRichText(
  ctx: CanvasRenderingContext2D,
  d: ChartDrawing,
  rawA: { x: number; y: number },
  rawB: { x: number; y: number },
  isLight: boolean
) {
  if (d.showText === false || !d.text || d.text.trim().length === 0) return;
  const fSize = d.fontSize ?? 12;
  const alignH = d.textAlignH ?? 'center';
  const alignV = d.textAlignV ?? 'top';
  const orientation = d.textOrientation ?? 'along';
  const lineH = Math.round(fSize * 1.3);
  const lines = d.text.split('\n');

  // Always normalize left-to-right (or top-to-bottom for vertical lines)
  // so left/right text alignment matches visual screen sides consistently.
  const swap = rawB.x < rawA.x || (Math.abs(rawB.x - rawA.x) < 1 && rawB.y < rawA.y);
  const a = swap ? rawB : rawA;
  const b = swap ? rawA : rawB;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLen = Math.hypot(dx, dy);
  const ux = segLen > 0.001 ? dx / segLen : 1;
  const uy = segLen > 0.001 ? dy / segLen : 0;
  const inset = Math.min(14, segLen * 0.2);

  let anchorX: number;
  let anchorY: number;
  let canvasAlign: CanvasTextAlign;
  if (alignH === 'left') {
    anchorX = a.x + ux * inset;
    anchorY = a.y + uy * inset;
    canvasAlign = 'left';
  } else if (alignH === 'right') {
    anchorX = b.x - ux * inset;
    anchorY = b.y - uy * inset;
    canvasAlign = 'right';
  } else {
    anchorX = (a.x + b.x) * 0.5;
    anchorY = (a.y + b.y) * 0.5;
    canvasAlign = 'center';
  }

  let angle = segLen > 2 && orientation !== 'horizontal' ? Math.atan2(dy, dx) : 0;
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;

  const totalH = lines.length * lineH;
  const offsetY =
    alignV === 'top'
      ? -(totalH / 2 + 8)
      : alignV === 'bottom'
      ? totalH / 2 + 8
      : 0;

  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.rotate(angle);
  ctx.font = buildDrawingFont(d, 12);
  ctx.textBaseline = 'middle';
  ctx.textAlign = canvasAlign;

  if (alignV === 'middle') {
    const maxW = Math.max(24, ...lines.map((ln) => ctx.measureText(ln).width));
    const pillX =
      canvasAlign === 'left'
        ? -5
        : canvasAlign === 'right'
        ? -maxW - 5
        : -maxW / 2 - 5;
    drawRoundedRect(ctx, pillX, -totalH / 2 - 2, maxW + 10, totalH + 4, 3);
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.90)' : 'rgba(19, 23, 34, 0.88)';
    ctx.fill();
  }

  ctx.fillStyle = d.textColor || d.color;
  const startY = offsetY - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, startY + i * lineH);
  }
  ctx.restore();
}

const FIB_LEVEL_PALETTE: Record<string, string> = {
  '0': '#787b86',
  '0.236': '#f23645',
  '0.382': '#ff9800',
  '0.5': '#089981',
  '0.618': '#2962ff',
  '0.786': '#00bcd4',
  '1': '#787b86',
  '1.272': '#9c27b0',
  '1.618': '#e91e63',
  '2.618': '#f44336',
};

function getFibRatioColor(ratio: number, fallback: string): string {
  return FIB_LEVEL_PALETTE[String(ratio)] ?? fallback;
}

function renderSingleDrawingCanvas(
  ctx: CanvasRenderingContext2D,
  paneWidth: number,
  paneHeight: number,
  d: ChartDrawing,
  state: ChartOverlaysState,
  toCoords: (t: number, p: number) => { x: number | null; y: number | null }
) {
  if (d.visible === false || d.points.length === 0) return;

  const pixelPts = d.points.map((pt) => toCoords(pt.t, pt.p));
  if (pixelPts[0].x === null || pixelPts[0].y === null) return;

  const p0 = { x: pixelPts[0].x, y: pixelPts[0].y };
  const p1 = {
    x: pixelPts[1]?.x ?? p0.x + 140,
    y: pixelPts[1]?.y ?? p0.y,
  };
  const p2 =
    pixelPts[2] && pixelPts[2].x !== null && pixelPts[2].y !== null
      ? { x: pixelPts[2].x, y: pixelPts[2].y }
      : null;

  const rx = Math.min(p0.x, p1.x);
  const ry = Math.min(p0.y, p1.y);
  const rw = Math.max(16, Math.abs(p1.x - p0.x));
  const rh = Math.max(12, Math.abs(p1.y - p0.y));

  const isSelected = d.id === state.selectedDrawingId;
  const isHovered = d.id === state.hoveredDrawingId;
  const showHandles =
    (isSelected || isHovered || d.id === 'draft-preview') &&
    d.tool !== 'brush' &&
    d.tool !== 'highlighter';
  const strokeWidth = d.lineWidth ?? 1.8;
  const strokeAlpha = d.borderOpacity ?? 1;
  const fillAlpha = d.fillOpacity ?? 0.16;
  const showLabels = d.showLabels !== false;
  const dash = getDashPattern(d.lineStyle);
  const { candles, symbolInfo, isLight } = state;
  const maxW = Math.max(paneWidth, 3000);
  const maxH = Math.max(paneHeight, 2000);
  const plotRightX = Math.max(80, paneWidth);

  ctx.save();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeAlpha < 0.999 ? hexToRgba(d.color, strokeAlpha) : d.color;
  ctx.fillStyle = d.color;
  ctx.setLineDash(dash);

  // 1. Horizontal Line
  if (d.tool === 'horizontal-line') {
    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(0, p0.y);
      ctx.lineTo(maxW, p0.y);
      ctx.stroke();
    }

    if (d.showText !== false && d.text && d.text.trim().length > 0) {
      const hLeft = { x: 8, y: p0.y };
      const hRight = { x: Math.max(80, plotRightX - (showLabels ? 72 : 8)), y: p0.y };
      drawLineRichText(ctx, d, hLeft, hRight, isLight);
    }

    if (showLabels) {
      const priceLabel = formatPrice(d.points[0].p, symbolInfo.decimals);
      const badgeW = Math.max(58, priceLabel.length * 6.5 + 10);
      ctx.setLineDash([]);
      drawRoundedRect(ctx, plotRightX - badgeW - 6, p0.y - 9, badgeW, 18, 3);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(priceLabel, plotRightX - badgeW / 2 - 6, p0.y + 3.5);
      ctx.textAlign = 'left';
    }

    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 2. Horizontal Ray
  if (d.tool === 'horizontal-ray') {
    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(maxW, p0.y);
      ctx.stroke();
    }
    if (d.showText !== false && d.text && d.text.trim().length > 0 && p0.x <= plotRightX - 16) {
      const rayLeft = { x: Math.max(8, p0.x), y: p0.y };
      const rayRight = { x: Math.max(rayLeft.x + 24, plotRightX - 8), y: p0.y };
      drawLineRichText(ctx, d, rayLeft, rayRight, isLight);
    }
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 3. Vertical Line
  if (d.tool === 'vertical-line') {
    ctx.setLineDash(dash.length ? dash : [5, 4]);
    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(p0.x, 0);
      ctx.lineTo(p0.x, maxH);
      ctx.stroke();
    }
    if (d.showText !== false && d.text && d.text.trim().length > 0) {
      const vTop = { x: p0.x, y: 24 };
      const vBot = { x: p0.x, y: Math.max(160, paneHeight - 40) };
      drawLineRichText(
        ctx,
        { ...d, textOrientation: d.textOrientation ?? 'along' },
        vBot,
        vTop,
        isLight
      );
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 4. Cross Line
  if (d.tool === 'cross-line') {
    ctx.setLineDash(dash.length ? dash : [4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, p0.y);
    ctx.lineTo(maxW, p0.y);
    ctx.moveTo(p0.x, 0);
    ctx.lineTo(p0.x, maxH);
    ctx.stroke();
    if (d.showText !== false && d.text && d.text.trim().length > 0) {
      ctx.font = buildDrawingFont(d, 11);
      ctx.fillStyle = d.textColor || d.color;
      ctx.fillText(d.text, p0.x + 8, p0.y - 8);
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 5. Text Note / Callout / Price Label
  if (d.tool === 'text-note' || d.tool === 'callout' || d.tool === 'price-label') {
    const fSize = d.fontSize ?? 12;
    const rawLabel =
      d.text ||
      (d.tool === 'price-label'
        ? formatPrice(d.points[0].p, symbolInfo.decimals)
        : 'Annotation');
    const lines = rawLabel.split('\n');
    const maxChars = Math.max(6, ...lines.map((l) => l.length));
    const lineH = fSize + 5;
    const boxW = Math.max(96, maxChars * (fSize * 0.62) + 22);
    const boxH = Math.max(24, lines.length * lineH + 10);

    if (d.tool === 'price-label') {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x + 10, p0.y - boxH / 2);
      ctx.lineTo(p0.x + 10 + boxW, p0.y - boxH / 2);
      ctx.lineTo(p0.x + 10 + boxW, p0.y + boxH / 2);
      ctx.lineTo(p0.x + 10, p0.y + boxH / 2);
      ctx.closePath();
      ctx.fillStyle = d.fillColor || d.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected ? '#ffffff' : d.color;
      ctx.stroke();

      ctx.fillStyle = d.textColor || '#ffffff';
      ctx.font = buildDrawingFont(d, fSize);
      lines.forEach((ln, li) => {
        ctx.fillText(ln, p0.x + 16, p0.y - boxH / 2 + 16 + li * lineH);
      });
      if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
      ctx.restore();
      return;
    }

    if (d.tool === 'callout') {
      const bx = p1.x - 10;
      const by = p1.y - boxH;
      const boxCx = bx + boxW / 2;
      const boxCy = by + boxH / 2;
      const angle = Math.atan2(p0.y - boxCy, p0.x - boxCx);
      const baseSpread = 8;
      const anchorEdgeX = bx + Math.max(14, Math.min(boxW - 14, boxW / 2));
      const anchorEdgeY = p0.y > boxCy ? by + boxH : by;

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(
        anchorEdgeX - Math.sin(angle) * baseSpread,
        anchorEdgeY + Math.cos(angle) * (baseSpread * 0.25)
      );
      ctx.lineTo(
        anchorEdgeX + Math.sin(angle) * baseSpread,
        anchorEdgeY - Math.cos(angle) * (baseSpread * 0.25)
      );
      ctx.closePath();
      ctx.fillStyle = hexToRgba(d.color, 0.22);
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = d.color;
      ctx.stroke();

      drawRoundedRect(ctx, bx, by, boxW, boxH, 5);
      ctx.fillStyle = d.fillColor
        ? hexToRgba(d.fillColor, Math.max(0.25, fillAlpha))
        : isLight
        ? 'rgba(255, 255, 255, 0.94)'
        : 'rgba(19, 23, 34, 0.92)';
      ctx.fill();
      ctx.lineWidth = isSelected ? 1.8 : 1.3;
      ctx.strokeStyle = d.color;
      ctx.stroke();

      ctx.fillStyle = d.textColor || (isLight ? '#131722' : '#eef1f7');
      ctx.font = buildDrawingFont(d, fSize);
      lines.forEach((ln, li) => {
        ctx.fillText(ln, bx + 10, by + 16 + li * lineH);
      });
      if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
      ctx.restore();
      return;
    }

    drawRoundedRect(ctx, p0.x, p0.y - boxH, boxW, boxH, 5);
    ctx.fillStyle = d.fillColor
      ? hexToRgba(d.fillColor, Math.max(0.2, fillAlpha))
      : isLight
      ? 'rgba(255, 255, 255, 0.94)'
      : isSelected
      ? '#1c2333'
      : 'rgba(19, 23, 34, 0.90)';
    ctx.fill();
    ctx.lineWidth = isSelected ? 1.8 : 1.2;
    ctx.setLineDash([]);
    ctx.strokeStyle = d.color;
    ctx.stroke();
    ctx.fillStyle = d.textColor || (isLight ? '#131722' : '#ffffff');
    ctx.font = buildDrawingFont(d, fSize);
    lines.forEach((ln, li) => {
      ctx.fillText(ln, p0.x + 10, p0.y - boxH + 16 + li * lineH);
    });
    if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 6. Trend Line / Ray / Extended Line / Info Line
  if (
    d.tool === 'trend-line' ||
    d.tool === 'ray' ||
    d.tool === 'extended-line' ||
    d.tool === 'info-line'
  ) {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy);

    const extL = d.tool === 'extended-line' || Boolean(d.extendLeft);
    const extR = d.tool === 'ray' || d.tool === 'extended-line' || Boolean(d.extendRight);
    const extendSpan = Math.max(paneWidth, paneHeight) * 3 + 3000;

    let sx = p0.x;
    let sy = p0.y;
    let ex = p1.x;
    let ey = p1.y;

    if ((extL || extR) && len > 1) {
      if (d.tool === 'ray') {
        const ux = dx / len;
        const uy = dy / len;
        if (extL) {
          sx = p0.x - ux * extendSpan;
          sy = p0.y - uy * extendSpan;
        }
        if (extR) {
          ex = p1.x + ux * extendSpan;
          ey = p1.y + uy * extendSpan;
        }
      } else {
        const swapPts = p1.x < p0.x || (Math.abs(p1.x - p0.x) < 0.5 && p1.y < p0.y);
        const leftPt = swapPts ? p1 : p0;
        const rightPt = swapPts ? p0 : p1;
        const ddx = rightPt.x - leftPt.x;
        const ddy = rightPt.y - leftPt.y;
        const dLen = Math.hypot(ddx, ddy) || 1;
        const ux = ddx / dLen;
        const uy = ddy / dLen;
        sx = extL ? leftPt.x - ux * extendSpan : leftPt.x;
        sy = extL ? leftPt.y - uy * extendSpan : leftPt.y;
        ex = extR ? rightPt.x + ux * extendSpan : rightPt.x;
        ey = extR ? rightPt.y + uy * extendSpan : rightPt.y;
      }
    }

    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      if (len > 14) {
        if (d.leftEnd === 'arrow' && !extL) {
          drawArrowhead(ctx, p1.x, p1.y, p0.x, p0.y, Math.max(8, strokeWidth * 3.5));
        }
        if (d.rightEnd === 'arrow' && !extR) {
          drawArrowhead(ctx, p0.x, p0.y, p1.x, p1.y, Math.max(8, strokeWidth * 3.5));
        }
      }
    }

    if (d.showMiddlePoint && len > 10) {
      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.restore();
    }

    const showAnyStats =
      d.tool === 'info-line' ||
      (d.tool === 'trend-line' && d.id === 'draft-preview' && len > 12) ||
      (Boolean(d.alwaysShowStats || isSelected) &&
        Boolean(d.showPriceRange || d.showPercentChange || d.showBarsRange || d.showAngle));

    if (showAnyStats) {
      const stats = computeMeasureStats(
        candles,
        d.points[0].t,
        d.points[0].p,
        d.points[1]?.t ?? d.points[0].t,
        d.points[1]?.p ?? d.points[0].p,
        dx,
        dy
      );
      if (d.tool === 'info-line') {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexToRgba(d.color, 0.55);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
        ctx.restore();
      }
      const midX = (p0.x + p1.x) / 2;
      const midY = (p0.y + p1.y) / 2;
      const useDefaults = d.tool === 'info-line' || d.id === 'draft-preview';
      const showPrice = useDefaults || Boolean(d.showPriceRange);
      const showPct = useDefaults || Boolean(d.showPercentChange);
      const showBars = useDefaults || Boolean(d.showBarsRange);
      const showAng = useDefaults || Boolean(d.showAngle);

      const parts1: string[] = [];
      if (showPrice) parts1.push(`${stats.priceDiff >= 0 ? '+' : ''}${formatPrice(stats.priceDiff, symbolInfo.decimals)}`);
      if (showPct) parts1.push(`(${stats.percentDiff.toFixed(2)}%)`);
      const parts2: string[] = [];
      if (showBars) parts2.push(`${stats.barsCount} bars · ${stats.durationLabel}`);
      if (showAng) parts2.push(`${stats.angleDeg.toFixed(1)}°`);

      const line1 = parts1.join(' ');
      const line2 = parts2.join(' · ');
      const cardH = line1 && line2 ? 32 : 20;
      const cardOffset = d.text ? 46 : 6;
      const cardY = midY - cardOffset - cardH;
      const cardW = Math.max(116, Math.max(line1.length, line2.length) * 6.4 + 18);

      ctx.setLineDash([]);
      drawRoundedRect(ctx, midX - cardW / 2, cardY, cardW, cardH, 5);
      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(19, 23, 34, 0.94)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = d.color;
      ctx.stroke();
      ctx.fillStyle = isLight ? '#131722' : '#ffffff';
      ctx.font = '700 10px monospace';
      ctx.textAlign = 'center';
      if (line1) {
        ctx.fillText(line1, midX, cardY + 13);
      }
      if (line2) {
        ctx.fillStyle = isLight ? '#5d606b' : '#9598a1';
        ctx.font = '9.5px monospace';
        ctx.fillText(line2, midX, line1 ? cardY + 26 : cardY + 13);
      }
      ctx.textAlign = 'left';
    }

    if (extL || extR) {
      const clipped = clipLineSegmentToRect(
        { x: sx, y: sy },
        { x: ex, y: ey },
        8,
        8,
        Math.max(40, plotRightX - 8),
        Math.max(40, paneHeight - 8)
      );
      if (clipped) {
        drawLineRichText(ctx, d, clipped.start, clipped.end, isLight);
      }
    } else {
      drawLineRichText(ctx, d, p0, p1, isLight);
    }

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 7. Parallel Channel (True 3-point Sloped Parallelogram + Extend L/R + Median)
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

    const dx = r1R.x - r1L.x;
    const dy = r1R.y - r1L.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const extendSpan = Math.max(paneWidth, paneHeight) * 3 + 3000;
    const extL = d.extendLeft ? extendSpan : 0;
    const extR = d.extendRight ? extendSpan : 0;

    const r1a = { x: r1L.x - ux * extL, y: r1L.y - uy * extL };
    const r1b = { x: r1R.x + ux * extR, y: r1R.y + uy * extR };
    const r2a = { x: r2L.x - ux * extL, y: r2L.y - uy * extL };
    const r2b = { x: r2R.x + ux * extR, y: r2R.y + uy * extR };
    const m1 = { x: mL.x - ux * extL, y: mL.y - uy * extL };
    const m2 = { x: mR.x + ux * extR, y: mR.y + uy * extR };

    if (d.showFill !== false && fillAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(r1a.x, r1a.y);
      ctx.lineTo(r1b.x, r1b.y);
      ctx.lineTo(r2b.x, r2b.y);
      ctx.lineTo(r2a.x, r2a.y);
      ctx.closePath();
      ctx.fillStyle = hexToRgba(d.fillColor || d.color, fillAlpha);
      ctx.fill();
    }

    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      ctx.moveTo(r1a.x, r1a.y);
      ctx.lineTo(r1b.x, r1b.y);
      ctx.moveTo(r2a.x, r2a.y);
      ctx.lineTo(r2b.x, r2b.y);
      ctx.stroke();
    }

    if (d.showMidline !== false) {
      ctx.save();
      ctx.setLineDash(getDashPattern(d.midlineStyle ?? 'dashed'));
      ctx.lineWidth = d.midlineWidth ?? 1.1;
      ctx.strokeStyle = hexToRgba(d.midlineColor || d.color, d.midlineOpacity ?? 0.8);
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.lineTo(m2.x, m2.y);
      ctx.stroke();
      ctx.restore();
    }

    if (d.extendLeft || d.extendRight) {
      const clippedMid = clipLineSegmentToRect(
        m1,
        m2,
        8,
        8,
        Math.max(40, plotRightX - 8),
        Math.max(40, paneHeight - 8)
      );
      if (clippedMid) {
        drawLineRichText(ctx, d, clippedMid.start, clippedMid.end, isLight);
      }
    } else {
      drawLineRichText(ctx, d, ch.midStart, ch.midEnd, isLight);
    }

    const handles = p2 ? [p0, p1, p2] : [p0, p1];
    if (showHandles) drawHandlesCanvas(ctx, handles, isSelected, d.color);
    ctx.restore();
    return;
  }

  // 7b. Institutional Liquidity Pool / Settlement Stop Channel
  if (d.tool === 'liquidity-box' || d.tool === 'stop-channel') {
    const tag = d.tool === 'liquidity-box' ? 'L' : 'S';
    const midY = (p0.y + p1.y) / 2;

    ctx.fillStyle =
      d.tool === 'stop-channel'
        ? hexToRgba(d.fillColor || '#f23645', fillAlpha || 0.14)
        : hexToRgba(d.fillColor || d.color, fillAlpha);
    ctx.fillRect(rx, ry, rw, rh);

    ctx.beginPath();
    ctx.moveTo(rx, p0.y);
    ctx.lineTo(rx + rw, p0.y);
    ctx.moveTo(rx, p1.y);
    ctx.lineTo(rx + rw, p1.y);
    ctx.stroke();

    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, midY);
    ctx.lineTo(rx + rw, midY);
    ctx.stroke();

    ctx.fillStyle = d.textColor || d.color;
    ctx.font = buildDrawingFont(d, 11);
    ctx.textAlign = 'center';
    ctx.fillText(
      d.text || `${tag} · ${formatPrice(Math.abs(d.p1 - d.p2), symbolInfo.decimals)} pts`,
      rx + rw / 2,
      midY - 4
    );
    ctx.textAlign = 'left';

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 8. Rectangle (1:1 TradingView: Extend L/R, Independent Fill/Border/Dotted Midline, Rich Text, 8 Resize Handles)
  if (d.tool === 'rectangle') {
    const visLeft = d.extendLeft ? 0 : rx;
    const visRight = d.extendRight ? maxW : rx + rw;
    const visW = Math.max(16, visRight - visLeft);

    if (d.showFill !== false && fillAlpha > 0) {
      ctx.fillStyle = hexToRgba(d.fillColor || d.color, fillAlpha);
      ctx.fillRect(visLeft, ry, visW, rh);
    }

    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.beginPath();
      // Top & Bottom horizontal edges
      ctx.moveTo(visLeft, ry);
      ctx.lineTo(visRight, ry);
      ctx.moveTo(visLeft, ry + rh);
      ctx.lineTo(visRight, ry + rh);
      // Left / Right vertical edges (open when extended just like TradingView)
      if (!d.extendLeft) {
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + rh);
      }
      if (!d.extendRight) {
        ctx.moveTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + rh);
      }
      ctx.stroke();
    }

    if (d.showMidline) {
      ctx.save();
      const midDash = getDashPattern(d.midlineStyle ?? 'dotted');
      ctx.setLineDash(midDash);
      ctx.lineWidth = d.midlineWidth ?? 1;
      ctx.strokeStyle = hexToRgba(d.midlineColor || d.color, d.midlineOpacity ?? 0.75);
      ctx.beginPath();
      ctx.moveTo(visLeft, ry + rh / 2);
      ctx.lineTo(visRight, ry + rh / 2);
      ctx.stroke();
      ctx.restore();
    }

    // Keep extended rectangle text pinned to the visible viewport sides as the chart pans
    const rectOffscreen =
      (!d.extendLeft && !d.extendRight && (rx + rw < 0 || rx > plotRightX)) ||
      (d.extendLeft && !d.extendRight && rx + rw < 0) ||
      (!d.extendLeft && d.extendRight && rx > plotRightX);
    if (!rectOffscreen) {
      const textBoxLeft = d.extendLeft ? 0 : Math.max(0, rx);
      const textBoxRight = d.extendRight ? plotRightX : Math.min(plotRightX, rx + rw);
      const textBoxW = textBoxRight - textBoxLeft;
      if (textBoxW >= 24) {
        drawBoxRichText(
          ctx,
          d,
          textBoxLeft,
          ry,
          textBoxW,
          rh,
          isLight,
          'middle'
        );
      }
    }

    if (showHandles) drawRectangleHandlesCanvas(ctx, p0, p1, isSelected, d.color);
    ctx.restore();
    return;
  }

  if (d.tool === 'circle') {
    const cx = (p0.x + p1.x) / 2;
    const cy = (p0.y + p1.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(10, rw / 2), Math.max(10, rh / 2), 0, 0, Math.PI * 2);
    if (d.showFill !== false && fillAlpha > 0) {
      ctx.fillStyle = hexToRgba(d.fillColor || d.color, fillAlpha);
      ctx.fill();
    }
    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.stroke();
    }
    drawBoxRichText(ctx, d, rx, ry, rw, rh, isLight, 'middle');
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  if (d.tool === 'triangle') {
    const a = p2 ? p0 : { x: (p0.x + p1.x) / 2, y: p0.y };
    const b = p2 ? p1 : { x: p0.x, y: p1.y };
    const c = p2 ? p2 : { x: p1.x, y: p1.y };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    if (d.showFill !== false && fillAlpha > 0) {
      ctx.fillStyle = hexToRgba(d.fillColor || d.color, fillAlpha);
      ctx.fill();
    }
    if (d.showBorder !== false && strokeAlpha > 0) {
      ctx.stroke();
    }
    const minTx = Math.min(a.x, b.x, c.x);
    const maxTx = Math.max(a.x, b.x, c.x);
    const minTy = Math.min(a.y, b.y, c.y);
    const maxTy = Math.max(a.y, b.y, c.y);
    drawBoxRichText(ctx, d, minTx, minTy, Math.max(30, maxTx - minTx), Math.max(24, maxTy - minTy), isLight, 'middle');
    const triHandles = p2 ? [a, b, c] : [p0, p1];
    if (showHandles) drawHandlesCanvas(ctx, triHandles, isSelected, d.color);
    ctx.restore();
    return;
  }

  // 9. Measure / Price Range / Date Range (3 distinct TradingView geometries)
  if (d.tool === 'price-range') {
    const stats = computeMeasureStats(
      candles,
      d.points[0].t,
      d.points[0].p,
      d.points[1]?.t ?? d.points[0].t,
      d.points[1]?.p ?? d.points[0].p
    );
    const isUp = stats.priceDiff >= 0;
    const col = isUp ? '#089981' : '#f23645';
    const midX = rx + rw / 2;

    ctx.fillStyle = isUp ? 'rgba(8, 153, 129, 0.14)' : 'rgba(242, 54, 69, 0.14)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(rx, p0.y);
    ctx.lineTo(rx + rw, p0.y);
    ctx.moveTo(rx, p1.y);
    ctx.lineTo(rx + rw, p1.y);
    ctx.moveTo(midX, p0.y);
    ctx.lineTo(midX, p1.y);
    ctx.stroke();
    drawArrowhead(ctx, midX, p0.y, midX, p1.y, 7);

    const ticks = symbolInfo.tickSize > 0 ? Math.round(Math.abs(stats.priceDiff) / symbolInfo.tickSize) : 0;
    drawRoundedRect(ctx, midX - 88, isUp ? ry - 30 : ry + rh + 6, 176, 22, 4);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${isUp ? '+' : ''}${formatPrice(stats.priceDiff, symbolInfo.decimals)} (${stats.percentDiff.toFixed(2)}%) · ${ticks}t`,
      midX,
      isUp ? ry - 15 : ry + rh + 21
    );
    ctx.textAlign = 'left';

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, col);
    ctx.restore();
    return;
  }

  if (d.tool === 'date-range') {
    const stats = computeMeasureStats(
      candles,
      d.points[0].t,
      d.points[0].p,
      d.points[1]?.t ?? d.points[0].t,
      d.points[1]?.p ?? d.points[0].p
    );
    const col = d.color || '#2962ff';
    const midY = ry + rh / 2;

    ctx.fillStyle = hexToRgba(col, 0.14);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p0.x, ry);
    ctx.lineTo(p0.x, ry + rh);
    ctx.moveTo(p1.x, ry);
    ctx.lineTo(p1.x, ry + rh);
    ctx.moveTo(p0.x, midY);
    ctx.lineTo(p1.x, midY);
    ctx.stroke();
    drawArrowhead(ctx, p0.x, midY, p1.x, midY, 7);

    drawRoundedRect(ctx, rx + rw / 2 - 74, ry + rh + 6, 148, 22, 4);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${stats.barsCount} bars · ${stats.durationLabel}`, rx + rw / 2, ry + rh + 21);
    ctx.textAlign = 'left';

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, col);
    ctx.restore();
    return;
  }

  if (d.tool === 'measure') {
    const tMin = Math.min(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const tMax = Math.max(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const stats = computeMeasureStats(
      candles,
      d.points[0].t,
      d.points[0].p,
      d.points[1]?.t ?? d.points[0].t,
      d.points[1]?.p ?? d.points[0].p
    );
    const rangeVol = candles
      .filter((c) => c.time >= tMin && c.time <= tMax)
      .reduce((acc, c) => acc + (c.volume || 0), 0);
    const isPositive = stats.priceDiff >= 0;
    const boxColor = isPositive ? '#2962ff' : '#f23645';

    ctx.fillStyle = isPositive ? 'rgba(41, 98, 255, 0.16)' : 'rgba(242, 54, 69, 0.16)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);

    const midX = rx + rw / 2;
    const midY = ry + rh / 2;
    ctx.beginPath();
    ctx.moveTo(midX, p0.y);
    ctx.lineTo(midX, p1.y);
    ctx.moveTo(p0.x, midY);
    ctx.lineTo(p1.x, midY);
    ctx.stroke();
    drawArrowhead(ctx, midX, p0.y, midX, p1.y, 6.5);
    drawArrowhead(ctx, p0.x, midY, p1.x, midY, 6.5);

    drawRoundedRect(ctx, midX - 94, ry + rh + 6, 188, 36, 4);
    ctx.fillStyle = boxColor;
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10.5px monospace';
    ctx.fillText(
      `${isPositive ? '+' : ''}${formatPrice(stats.priceDiff, symbolInfo.decimals)} (${stats.percentDiff.toFixed(2)}%)`,
      midX,
      ry + rh + 20
    );
    ctx.fillStyle = '#e3f2fd';
    ctx.font = '9.5px monospace';
    ctx.fillText(
      `${stats.barsCount} bars · ${stats.durationLabel}${rangeVol > 0 ? ` · Vol ${Math.round(rangeVol).toLocaleString()}` : ''}`,
      midX,
      ry + rh + 35
    );
    ctx.textAlign = 'left';

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 10. Fib Retracement
  if (d.tool === 'fib-levels') {
    const ratios = d.fibRatios ?? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const levels = computeFibLevels(
      d.points[0].p,
      d.points[1]?.p ?? d.points[0].p,
      ratios,
      Boolean(d.reverseFib)
    );
    const fibStartX = d.extendLeft ? 0 : rx;
    const fibEndX = d.extendRight ? maxW : rx + Math.max(120, rw);
    const fibW = Math.max(120, fibEndX - fibStartX);

    ctx.save();
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();

    for (let idx = 0; idx < levels.length; idx++) {
      const lvl = levels[idx];
      const lvlColor = getFibRatioColor(lvl.ratio, d.color);
      const coord = toCoords(d.points[0].t, lvl.price);
      if (coord.y === null) continue;
      const nextLvl = levels[idx + 1];
      const nextCoord = nextLvl ? toCoords(d.points[0].t, nextLvl.price) : null;
      if (nextCoord && nextCoord.y !== null) {
        ctx.fillStyle = hexToRgba(lvlColor, Math.min(0.24, fillAlpha * 0.65));
        ctx.fillRect(fibStartX, Math.min(coord.y, nextCoord.y), fibW, Math.abs(nextCoord.y - coord.y));
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = lvlColor;
      ctx.lineWidth = lvl.ratio === 0.618 || lvl.ratio === 0.5 ? 1.6 : 1.1;
      ctx.beginPath();
      ctx.moveTo(fibStartX, coord.y);
      ctx.lineTo(fibStartX + fibW, coord.y);
      ctx.stroke();

      if (showLabels) {
        ctx.fillStyle = lvlColor;
        ctx.font = '600 9.5px monospace';
        ctx.fillText(
          `${lvl.ratio} (${formatPrice(lvl.price, symbolInfo.decimals)})`,
          Math.max(6, fibStartX + 4),
          coord.y - 3
        );
      }
    }

    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 11a. 3-Point Trend-Based Fib Extension
  if (d.tool === 'fib-extension') {
    const third = p2 ?? p1;
    const p3Price = d.points[2]?.p ?? d.points[1]?.p ?? d.points[0].p;
    const ratios = d.fibRatios ?? DEFAULT_FIB_EXTENSION_RATIOS;
    const levels = computeFibExtensionLevels(
      d.points[0].p,
      d.points[1]?.p ?? d.points[0].p,
      p3Price,
      ratios,
      Boolean(d.reverseFib)
    );

    // Trend leg A -> B -> C dashed guide
    ctx.save();
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    if (p2) {
      ctx.lineTo(third.x, third.y);
    }
    ctx.stroke();
    ctx.restore();

    if (p2 || d.points.length >= 3) {
      const startX = Math.min(p1.x, third.x);
      const endX = d.extendRight ? maxW : Math.max(p0.x, p1.x, third.x) + 180;
      const extW = Math.max(140, endX - startX);

      for (let idx = 0; idx < levels.length; idx++) {
        const lvl = levels[idx];
        const lvlColor = getFibRatioColor(lvl.ratio, d.color);
        const coord = toCoords(d.points[0].t, lvl.price);
        if (coord.y === null) continue;
        const nextLvl = levels[idx + 1];
        const nextCoord = nextLvl ? toCoords(d.points[0].t, nextLvl.price) : null;
        if (nextCoord && nextCoord.y !== null) {
          ctx.fillStyle = hexToRgba(lvlColor, Math.min(0.22, fillAlpha * 0.6));
          ctx.fillRect(startX, Math.min(coord.y, nextCoord.y), extW, Math.abs(nextCoord.y - coord.y));
        }

        ctx.setLineDash([]);
        ctx.strokeStyle = lvlColor;
        ctx.lineWidth = lvl.ratio === 1 || lvl.ratio === 1.618 || lvl.ratio === 0.618 ? 1.6 : 1.1;
        ctx.beginPath();
        ctx.moveTo(startX, coord.y);
        ctx.lineTo(startX + extW, coord.y);
        ctx.stroke();

        if (showLabels) {
          ctx.fillStyle = lvlColor;
          ctx.font = '600 9.5px monospace';
          ctx.fillText(
            `${lvl.ratio} (${formatPrice(lvl.price, symbolInfo.decimals)})`,
            d.extendRight ? Math.max(6, startX + 4) : startX + 4,
            coord.y - 3
          );
        }
      }
    }

    const handles = p2 ? [p0, p1, p2] : [p0, p1];
    if (showHandles) drawHandlesCanvas(ctx, handles, isSelected, d.color);
    ctx.restore();
    return;
  }

  // 11b. 3-Point Andrews Pitchfork
  if (d.tool === 'pitchfork') {
    const third = p2 ?? { x: p1.x + 80, y: p0.y };
    const midX = (p1.x + third.x) / 2;
    const midY = (p1.y + third.y) / 2;
    const dx = midX - p0.x;
    const dy = midY - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = (dx / len) * 2600;
    const uy = (dy / len) * 2600;

    // Upper and lower shaded channels
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + ux, p1.y + uy);
    ctx.lineTo(midX + ux, midY + uy);
    ctx.lineTo(midX, midY);
    ctx.closePath();
    ctx.fillStyle = hexToRgba(d.color, fillAlpha * 0.65);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(midX + ux, midY + uy);
    ctx.lineTo(third.x + ux, third.y + uy);
    ctx.lineTo(third.x, third.y);
    ctx.closePath();
    ctx.fillStyle = hexToRgba('#089981', fillAlpha * 0.55);
    ctx.fill();

    // Median line
    ctx.setLineDash([]);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = strokeWidth;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p0.x + ux, p0.y + uy);
    ctx.stroke();

    // Outer parallel tines + 0.5 internal sub-medians
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p1.x + ux, p1.y + uy);
    ctx.moveTo(third.x, third.y);
    ctx.lineTo(third.x + ux, third.y + uy);
    ctx.stroke();

    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(d.color, 0.7);
    const q1x = (p1.x + midX) / 2;
    const q1y = (p1.y + midY) / 2;
    const q2x = (third.x + midX) / 2;
    const q2y = (third.y + midY) / 2;
    ctx.beginPath();
    ctx.moveTo(q1x, q1y);
    ctx.lineTo(q1x + ux, q1y + uy);
    ctx.moveTo(q2x, q2y);
    ctx.lineTo(q2x + ux, q2y + uy);
    ctx.stroke();

    // Anchor stem p1 <-> p2
    ctx.setLineDash([]);
    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(third.x, third.y);
    ctx.stroke();

    const handles = p2 ? [p0, p1, third] : [p0, p1];
    if (showHandles) drawHandlesCanvas(ctx, handles, isSelected, d.color);
    ctx.restore();
    return;
  }

  // 12. Fixed Range Volume Profile (24 rows + Value Area VAH/VAL + Buy/Sell split + POC)
  if (d.tool === 'volume-profile') {
    const tMin = Math.min(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const tMax = Math.max(d.points[0].t, d.points[1]?.t ?? d.points[0].t);
    const lowP = Math.min(d.points[0].p, d.points[1]?.p ?? d.points[0].p);
    const highP = Math.max(d.points[0].p, d.points[1]?.p ?? d.points[0].p);
    const profile = computeVolumeProfile(candles, tMin, tMax, lowP, highP, 24);
    const rowH = rh / profile.rows.length;

    ctx.fillStyle = 'rgba(41, 98, 255, 0.04)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(rx, ry, rw, rh);

    for (let idx = 0; idx < profile.rows.length; idx++) {
      const row = profile.rows[idx];
      const svgIdx = profile.rows.length - 1 - idx;
      const barY = ry + svgIdx * rowH + 0.5;
      const barH = Math.max(1.5, rowH - 1);
      const barW = Math.max(4, rw * 0.85 * row.ratio);
      const tot = Math.max(1e-6, row.volume);
      const buyW = barW * (row.buyVolume / tot);
      const sellW = Math.max(0, barW - buyW);
      const alpha = row.inValueArea ? 0.62 : 0.25;

      ctx.fillStyle = row.isPOC
        ? 'rgba(242, 54, 69, 0.82)'
        : `rgba(8, 153, 129, ${alpha})`;
      ctx.fillRect(rx, barY, buyW, barH);
      if (sellW > 0.5) {
        ctx.fillStyle = row.isPOC
          ? 'rgba(242, 54, 69, 0.58)'
          : `rgba(41, 98, 255, ${alpha})`;
        ctx.fillRect(rx + buyW, barY, sellW, barH);
      }

      if (row.isPOC) {
        ctx.setLineDash([]);
        ctx.strokeStyle = '#f23645';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(rx, barY + barH / 2);
        ctx.lineTo(rx + rw, barY + barH / 2);
        ctx.stroke();
      }
    }

    // VAH / VAL dashed lines
    const cVah = toCoords(tMin, profile.vahPrice);
    const cVal = toCoords(tMin, profile.valPrice);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 1.1;
    if (cVah.y !== null) {
      ctx.beginPath();
      ctx.moveTo(rx, cVah.y);
      ctx.lineTo(rx + rw, cVah.y);
      ctx.stroke();
    }
    if (cVal.y !== null) {
      ctx.beginPath();
      ctx.moveTo(rx, cVal.y);
      ctx.lineTo(rx + rw, cVal.y);
      ctx.stroke();
    }

    if (showLabels) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = '700 10px monospace';
      ctx.fillText(
        `POC: ${formatPrice(profile.pocPrice, symbolInfo.decimals)} · VA: ${formatPrice(profile.valPrice, symbolInfo.decimals)}-${formatPrice(profile.vahPrice, symbolInfo.decimals)} · Vol: ${Math.round(profile.totalVolume).toLocaleString()}`,
        rx + 4,
        ry - 5
      );
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 13. Long Position & Short Position (TradingView Risk/Reward & Qty Calculator)
  if (d.tool === 'long-position' || d.tool === 'short-position') {
    const isLong = d.tool === 'long-position';
    const entryP = d.points[0].p;
    const tpP = d.points[1]?.p ?? (isLong ? entryP + 40 : entryP - 40);
    const slP = d.points[2]?.p ?? (isLong ? entryP - 20 : entryP + 20);
    const tpHandle = p1;
    const slHandle = p2 ?? { x: p1.x, y: p0.y + (p0.y - p1.y) };

    const boxRight = Math.max(p0.x + 128, tpHandle.x, slHandle.x);
    const boxW = Math.max(128, boxRight - p0.x);
    const stats = computePositionStats(isLong ? 'long' : 'short', entryP, tpP, slP);
    const acct = d.accountSize ?? 100000;
    const riskPct = d.riskPct ?? 1;
    const riskDollars = acct * (riskPct / 100);
    const estQty = stats.riskPoints > 0 ? Math.max(0, riskDollars / stats.riskPoints) : 0;

    const tpTop = Math.min(p0.y, tpHandle.y);
    const tpHeight = Math.max(10, Math.abs(tpHandle.y - p0.y));
    const slTop = Math.min(p0.y, slHandle.y);
    const slHeight = Math.max(10, Math.abs(slHandle.y - p0.y));

    const tpText =
      boxW >= 185
        ? `Target: ${formatPrice(stats.rewardPoints, symbolInfo.decimals)} (${stats.rewardPercent.toFixed(2)}%) · +$${Math.round(riskDollars * Math.max(0, stats.riskRewardRatio)).toLocaleString()}`
        : `TP: ${formatPrice(stats.rewardPoints, symbolInfo.decimals)}`;
    const slText =
      boxW >= 185
        ? `Stop: ${formatPrice(stats.riskPoints, symbolInfo.decimals)} (${stats.riskPercent.toFixed(2)}%) · -$${Math.round(riskDollars).toLocaleString()}`
        : `SL: ${formatPrice(stats.riskPoints, symbolInfo.decimals)}`;

    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(8, 153, 129, 0.22)';
    ctx.fillRect(p0.x, tpTop, boxW, tpHeight);
    ctx.strokeStyle = '#089981';
    ctx.lineWidth = 1;
    ctx.strokeRect(p0.x, tpTop, boxW, tpHeight);

    ctx.fillStyle = 'rgba(242, 54, 69, 0.22)';
    ctx.fillRect(p0.x, slTop, boxW, slHeight);
    ctx.strokeStyle = '#f23645';
    ctx.strokeRect(p0.x, slTop, boxW, slHeight);

    ctx.strokeStyle = '#787b86';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p0.x + boxW, p0.y);
    ctx.stroke();

    const tpLabelY = isLong ? tpTop + 4 : tpTop + tpHeight - 20;
    drawRoundedRect(ctx, p0.x + 4, tpLabelY, boxW - 8, 16, 2);
    ctx.fillStyle = '#089981';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9.5px monospace';
    ctx.fillText(tpText, p0.x + 8, tpLabelY + 11);

    const midBannerW = boxW >= 190 ? 156 : 96;
    drawRoundedRect(ctx, p0.x + boxW / 2 - midBannerW / 2, p0.y - 10, midBannerW, 20, 3);
    ctx.fillStyle = '#131722';
    ctx.fill();
    ctx.strokeStyle = '#434651';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      boxW >= 190
        ? `R/R ${stats.riskRewardRatio.toFixed(2)} · Qty ${estQty >= 10 ? Math.round(estQty) : estQty.toFixed(1)}`
        : `R/R: ${stats.riskRewardRatio.toFixed(2)}`,
      p0.x + boxW / 2,
      p0.y + 4
    );
    ctx.textAlign = 'left';

    const slLabelY = isLong ? slTop + slHeight - 20 : slTop + 4;
    drawRoundedRect(ctx, p0.x + 4, slLabelY, boxW - 8, 16, 2);
    ctx.fillStyle = '#f23645';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9.5px monospace';
    ctx.fillText(slText, p0.x + 8, slLabelY + 11);

    if (showHandles) drawHandlesCanvas(ctx, [p0, tpHandle, slHandle], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 14. Fib Time Zones / Cycles
  if (d.tool === 'time-cycles') {
    const zones = computeFibTimeZones(
      d.points[0].t,
      d.points[1]?.t ?? d.points[0].t + 600,
      [0, 1, 2, 3, 5, 8, 13, 21, 34]
    );
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    const zoneXs: Array<{ fib: number; x: number }> = [];
    for (const z of zones) {
      const c = toCoords(z.time, d.points[0].p);
      if (c.x !== null) zoneXs.push({ fib: z.fib, x: c.x });
    }

    for (let i = 0; i < zoneXs.length; i++) {
      if (i % 2 === 1 && i < zoneXs.length - 1) {
        ctx.fillStyle = hexToRgba(d.color, 0.05);
        ctx.fillRect(
          Math.min(zoneXs[i].x, zoneXs[i + 1].x),
          0,
          Math.abs(zoneXs[i + 1].x - zoneXs[i].x),
          maxH
        );
      }
      ctx.setLineDash([]);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(zoneXs[i].x, 0);
      ctx.lineTo(zoneXs[i].x, maxH);
      ctx.stroke();
      if (showLabels) {
        ctx.fillStyle = d.color;
        ctx.font = '700 10px monospace';
        ctx.fillText(String(zoneXs[i].fib), zoneXs[i].x + 3, 24);
      }
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 15. Bars Pattern Projection (proportional horizontal + vertical scaling across [p0..p1])
  if (d.tool === 'candle-pattern') {
    const bars =
      d.clonedBars && d.clonedBars.length > 0
        ? d.clonedBars
        : [
            { openOffset: 0, highOffset: 12, lowOffset: -4, closeOffset: 9 },
            { openOffset: 9, highOffset: 18, lowOffset: 5, closeOffset: 15 },
            { openOffset: 15, highOffset: 22, lowOffset: 11, closeOffset: 12 },
            { openOffset: 12, highOffset: 28, lowOffset: 10, closeOffset: 25 },
            { openOffset: 25, highOffset: 34, lowOffset: 20, closeOffset: 31 },
          ];
    const slotW = rw / Math.max(bars.length, 1);
    const barW = Math.max(3, Math.min(14, slotW * 0.68));
    const minOff = Math.min(...bars.map((b) => b.lowOffset));
    const maxOff = Math.max(...bars.map((b) => b.highOffset));
    const nativePriceSpan = Math.max(1e-6, maxOff - minOff);
    const draggedPriceSpan = Math.abs((d.points[1]?.p ?? d.points[0].p) - d.points[0].p);
    const yScale = draggedPriceSpan > symbolInfo.tickSize * 4 ? draggedPriceSpan / nativePriceSpan : 1;

    ctx.fillStyle = hexToRgba(d.color, 0.06);
    ctx.fillRect(rx, ry, rw, rh);
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    for (let idx = 0; idx < bars.length; idx++) {
      const b = bars[idx];
      const bx = rx + idx * slotW + (slotW - barW) / 2;
      const cO = toCoords(d.points[0].t, d.points[0].p + b.openOffset * yScale);
      const cC = toCoords(d.points[0].t, d.points[0].p + b.closeOffset * yScale);
      const cH = toCoords(d.points[0].t, d.points[0].p + b.highOffset * yScale);
      const cL = toCoords(d.points[0].t, d.points[0].p + b.lowOffset * yScale);
      if (cO.y === null || cC.y === null || cH.y === null || cL.y === null) continue;
      const bull = b.closeOffset >= b.openOffset;
      const col = bull ? 'rgba(8, 153, 129, 0.72)' : 'rgba(242, 54, 69, 0.72)';
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + barW / 2, cH.y);
      ctx.lineTo(bx + barW / 2, cL.y);
      ctx.stroke();
      ctx.fillRect(bx, Math.min(cO.y, cC.y), barW, Math.max(2, Math.abs(cC.y - cO.y)));
    }
    if (showHandles) drawHandlesCanvas(ctx, [p0, p1], isSelected, d.color);
    ctx.restore();
    return;
  }

  // 16. Multi-point Polyline / Wave Path / Elliott Impulse Wave / Smooth Bezier Brush & Highlighter
  const validPts = pixelPts.filter(
    (pt): pt is { x: number; y: number } => pt.x !== null && pt.y !== null
  );
  if (validPts.length >= 2) {
    const isBrush = d.tool === 'brush';
    const isHighlighter = d.tool === 'highlighter';
    const isFreehand = isBrush || isHighlighter;
    const isElliott = d.tool === 'elliott-wave';
    const isPath = d.tool === 'wave-path';

    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = isHighlighter ? Math.max(10, strokeWidth) : strokeWidth;
    ctx.globalAlpha = isHighlighter ? 0.35 : ctx.globalAlpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);

    ctx.beginPath();
    ctx.moveTo(validPts[0].x, validPts[0].y);
    if (isFreehand && validPts.length >= 3) {
      // Smooth quadratic midpoint Bezier curve for 1:1 TradingView Brush & Highlighter feel
      for (let i = 1; i < validPts.length - 1; i++) {
        const midX = (validPts[i].x + validPts[i + 1].x) / 2;
        const midY = (validPts[i].y + validPts[i + 1].y) / 2;
        ctx.quadraticCurveTo(validPts[i].x, validPts[i].y, midX, midY);
      }
      const last = validPts[validPts.length - 1];
      ctx.lineTo(last.x, last.y);
    } else {
      for (let i = 1; i < validPts.length; i++) {
        ctx.lineTo(validPts[i].x, validPts[i].y);
      }
    }
    ctx.stroke();

    if (isPath) {
      const prev = validPts[validPts.length - 2];
      const last = validPts[validPts.length - 1];
      drawArrowhead(ctx, prev.x, prev.y, last.x, last.y, 9);
    }
    ctx.restore();

    if (isElliott) {
      for (let idx = 0; idx < validPts.length; idx++) {
        const pt = validPts[idx];
        const prev = validPts[idx - 1];
        const next = validPts[idx + 1];
        // Place wave badge above local peaks (lower Y) and below local troughs (higher Y)
        let isPeak = idx % 2 === 1;
        if (prev && next) {
          isPeak = pt.y <= prev.y && pt.y <= next.y;
        } else if (next) {
          isPeak = pt.y < next.y;
        } else if (prev) {
          isPeak = pt.y < prev.y;
        }
        const badgeY = isPeak ? pt.y - 16 : pt.y + 16;

        ctx.beginPath();
        ctx.arc(pt.x, badgeY, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? '#ffffff' : '#131722';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = d.color;
        ctx.setLineDash([]);
        ctx.stroke();
        ctx.fillStyle = isLight ? '#131722' : '#ffffff';
        ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`(${idx === 0 ? '0' : String(idx)})`, pt.x, badgeY + 3.5);
        ctx.textAlign = 'left';
      }
    }

    if (showHandles) drawHandlesCanvas(ctx, validPts, isSelected, d.color);
    ctx.restore();
    return;
  }

  if (showHandles) drawHandlesCanvas(ctx, [p0], isSelected, d.color);
  ctx.restore();
}

export class ChartOverlaysPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApiBase<Time> | null = null;
  private _series: ISeriesApi<SeriesType, Time> | null = null;
  private _requestUpdate: (() => void) | null = null;

  private _state: ChartOverlaysState | null = null;
  private _livePreview: LiveDrawingPreviewState = {
    drawing: null,
    isGhost: false,
    snapPixel: null,
  };

  private readonly _bottomView: IPrimitivePaneView;
  private readonly _topView: IPrimitivePaneView;

  constructor() {
    this._bottomView = {
      zOrder: (): PrimitivePaneViewZOrder => 'bottom',
      renderer: (): IPrimitivePaneRenderer | null => {
        const state = this._state;
        const chart = this._chart;
        const series = this._series;
        if (!state || !chart || !series || state.candles.length === 0) return null;
        const hasGexOverlay =
          Boolean(state.gexExpectedMove) ||
          Boolean(state.gexShowHistogram && state.gexStrikes && state.gexStrikes.length > 0);
        const hasVpOverlay = Boolean(
          state.volumeProfileVisible &&
            state.volumeProfileData &&
            state.volumeProfileData.totalVolume > 0
        );
        if (!state.ssmtVisible && !state.ivWallsVisible && !hasGexOverlay && !hasVpOverlay) {
          return null;
        }

        return {
          draw: (target) => {
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
              const ts = chart.timeScale();
              const toCoords = (t: number, p: number) => ({
                x: timeToChartX(ts, state.candles, state.candleIntervalSec, t),
                y: (() => {
                  const py = series.priceToCoordinate(p);
                  return py !== null ? Number(py) : null;
                })(),
              });

              if (state.gexExpectedMove) {
                const yUp = series.priceToCoordinate(state.gexExpectedMove.upper);
                const yDn = series.priceToCoordinate(state.gexExpectedMove.lower);
                if (yUp !== null && yDn !== null) {
                  const topY = Math.min(Number(yUp), Number(yDn));
                  const bandH = Math.abs(Number(yDn) - Number(yUp));
                  if (bandH > 1) {
                    ctx.save();
                    ctx.fillStyle = state.isLight
                      ? 'rgba(168, 85, 247, 0.045)'
                      : 'rgba(168, 85, 247, 0.06)';
                    ctx.fillRect(0, topY, mediaSize.width, bandH);
                    ctx.restore();
                  }
                }
              }

              if (state.gexShowHistogram && state.gexStrikes && state.gexStrikes.length > 0) {
                const ratio =
                  state.gexSpotScaleRatio && Number.isFinite(state.gexSpotScaleRatio)
                    ? state.gexSpotScaleRatio
                    : 1;
                const plotRight = Math.max(80, mediaSize.width - 2);
                const maxBarW = Math.min(110, Math.max(48, mediaSize.width * 0.14));

                const onScreen: Array<{ s: GexStrikeLevel; y: number }> = [];
                let maxStrikeGex = 0.0001;
                for (const s of state.gexStrikes) {
                  const py = series.priceToCoordinate(s.strike * ratio);
                  if (py === null) continue;
                  const y = Number(py);
                  if (y < -12 || y > mediaSize.height + 12) continue;
                  onScreen.push({ s, y });
                  maxStrikeGex = Math.max(maxStrikeGex, Math.abs(s.callGex), Math.abs(s.putGex));
                }

                if (onScreen.length > 0) {
                  let minSpacing = 12;
                  for (let i = 1; i < onScreen.length; i++) {
                    const diff = Math.abs(onScreen[i].y - onScreen[i - 1].y);
                    if (diff > 1) minSpacing = Math.min(minSpacing, diff);
                  }
                  const barH = Math.max(2, Math.min(6, minSpacing * 0.36));

                  ctx.save();
                  for (const { s, y } of onScreen) {
                    const callW =
                      s.callGex > 0
                        ? Math.max(2, (Math.abs(s.callGex) / maxStrikeGex) * maxBarW)
                        : 0;
                    const putW =
                      s.putGex < 0
                        ? Math.max(2, (Math.abs(s.putGex) / maxStrikeGex) * maxBarW)
                        : 0;

                    if (callW > 0) {
                      ctx.fillStyle = state.isLight
                        ? 'rgba(8, 153, 129, 0.36)'
                        : 'rgba(8, 153, 129, 0.42)';
                      ctx.fillRect(plotRight - callW, y - barH - 0.5, callW, barH);
                    }
                    if (putW > 0) {
                      ctx.fillStyle = state.isLight
                        ? 'rgba(242, 54, 69, 0.34)'
                        : 'rgba(242, 54, 69, 0.40)';
                      ctx.fillRect(plotRight - putW, y + 0.5, putW, barH);
                    }
                  }
                  ctx.restore();
                }
              }

              if (state.ssmtVisible) {
                for (const zone of state.supplyDemandZones) {
                  const sIdx = Math.max(0, Math.min(state.candles.length - 1, zone.startTimeIndex));
                  const eIdx = Math.max(0, Math.min(state.candles.length - 1, zone.endTimeIndex));
                  const c1 = toCoords(state.candles[sIdx].time, zone.topPrice);
                  const c2 = toCoords(state.candles[eIdx].time, zone.bottomPrice);
                  if (c1.x === null || c1.y === null || c2.x === null || c2.y === null) continue;
                  const x = Math.min(c1.x, c2.x);
                  const y = Math.min(c1.y, c2.y);
                  const width = Math.max(12, Math.abs(c2.x - c1.x));
                  const height = Math.max(2, Math.abs(c2.y - c1.y));

                  ctx.save();
                  ctx.fillStyle = zone.color;
                  ctx.fillRect(x, y, width, height);
                  ctx.strokeStyle = zone.borderColor;
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(x, y + height);
                  ctx.lineTo(x + width, y + height);
                  ctx.stroke();
                  ctx.restore();
                }
              }

              if (state.ivWallsVisible && state.candles.length > 40 && state.ivWalls.length >= 6) {
                const leftBar = state.candles[Math.floor(state.candles.length * 0.25)];
                const midBar = state.candles[Math.floor(state.candles.length * 0.55)];
                const step1 = toCoords(leftBar.time, state.ivWalls[2].price);
                const step2 = toCoords(midBar.time, state.ivWalls[2].price);
                const lowStep1 = toCoords(state.candles[0].time, state.ivWalls[5].price);
                const lowStep2 = toCoords(leftBar.time, state.ivWalls[5].price);

                ctx.save();
                if (step1.x !== null && step2.x !== null && step1.y !== null) {
                  ctx.strokeStyle = state.isLight ? '#d1d4dc' : '#2a2e39';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(step1.x, step1.y);
                  ctx.lineTo(step2.x, step1.y);
                  ctx.stroke();
                }
                if (lowStep1.x !== null && lowStep2.x !== null && lowStep1.y !== null) {
                  ctx.strokeStyle = state.isLight ? '#e0e3eb' : '#2a2e39';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath();
                  ctx.moveTo(lowStep1.x, lowStep1.y);
                  ctx.lineTo(lowStep2.x, lowStep1.y);
                  ctx.stroke();
                }
                ctx.restore();
              }

              // Previous Day / Previous Week Volume Profile: VA Zone + Histogram Rows + VAH/VAL + POC
              if (state.volumeProfileVisible && state.volumeProfileData) {
                const vpCfg = state.volumeProfileConfig ?? DEFAULT_VOLUME_PROFILE_CONFIG;
                const vp = state.volumeProfileData;
                if (vp.totalVolume > 0 && vp.rows.length > 0) {
                    const yVah = series.priceToCoordinate(vp.vahPrice);
                    const yVal = series.priceToCoordinate(vp.valPrice);
                    const yPoc = series.priceToCoordinate(vp.pocPrice);
                    const plotW = mediaSize.width;
                    const maxBarW = Math.min(138, Math.max(54, plotW * 0.16));
                    const isLeft = vpCfg.placement === 'left';
                    const anchorX = isLeft ? 4 : Math.max(80, plotW - 4);

                    if (vpCfg.showValueArea && yVah !== null && yVal !== null) {
                      const vaTop = Math.min(Number(yVah), Number(yVal));
                      const vaH = Math.abs(Number(yVal) - Number(yVah));
                      if (vaH > 1) {
                        ctx.save();
                        ctx.fillStyle = state.isLight
                          ? 'rgba(41, 98, 255, 0.055)'
                          : 'rgba(41, 98, 255, 0.08)';
                        ctx.fillRect(0, vaTop, plotW, vaH);
                        ctx.restore();
                      }
                    }

                    ctx.save();
                    for (const row of vp.rows) {
                      if (row.volume <= 0) continue;
                      const yRowTop = series.priceToCoordinate(row.priceHigh);
                      const yRowBot = series.priceToCoordinate(row.priceLow);
                      if (yRowTop === null || yRowBot === null) continue;
                      const top = Math.min(Number(yRowTop), Number(yRowBot));
                      const rawH = Math.abs(Number(yRowBot) - Number(yRowTop));
                      const barH = Math.max(1.5, rawH - (rawH > 4 ? 1.2 : 0.4));
                      if (top + barH < -4 || top > mediaSize.height + 4) continue;

                      const totalW = Math.max(2, row.ratio * maxBarW);
                      const inVA = Boolean(row.inValueArea);

                      if (vpCfg.showUpDownSplit && row.volume > 0) {
                        const buyFrac = row.buyVolume / row.volume;
                        const buyW = totalW * buyFrac;
                        const sellW = Math.max(0, totalW - buyW);
                        const buyColor = row.isPOC
                          ? state.isLight
                            ? 'rgba(41, 98, 255, 0.78)'
                            : 'rgba(56, 189, 248, 0.84)'
                          : inVA
                          ? state.isLight
                            ? 'rgba(41, 98, 255, 0.48)'
                            : 'rgba(41, 98, 255, 0.54)'
                          : state.isLight
                          ? 'rgba(120, 123, 134, 0.24)'
                          : 'rgba(148, 163, 184, 0.20)';
                        const sellColor = row.isPOC
                          ? state.isLight
                            ? 'rgba(245, 158, 11, 0.82)'
                            : 'rgba(251, 191, 36, 0.86)'
                          : inVA
                          ? state.isLight
                            ? 'rgba(245, 158, 11, 0.46)'
                            : 'rgba(245, 158, 11, 0.52)'
                          : state.isLight
                          ? 'rgba(120, 123, 134, 0.14)'
                          : 'rgba(148, 163, 184, 0.12)';

                        if (isLeft) {
                          if (buyW > 0.2) {
                            ctx.fillStyle = buyColor;
                            ctx.fillRect(anchorX, top, buyW, barH);
                          }
                          if (sellW > 0.2) {
                            ctx.fillStyle = sellColor;
                            ctx.fillRect(anchorX + buyW, top, sellW, barH);
                          }
                        } else {
                          if (sellW > 0.2) {
                            ctx.fillStyle = sellColor;
                            ctx.fillRect(anchorX - sellW, top, sellW, barH);
                          }
                          if (buyW > 0.2) {
                            ctx.fillStyle = buyColor;
                            ctx.fillRect(anchorX - sellW - buyW, top, buyW, barH);
                          }
                        }
                      } else {
                        ctx.fillStyle = row.isPOC
                          ? 'rgba(242, 54, 69, 0.75)'
                          : inVA
                          ? state.isLight
                            ? 'rgba(41, 98, 255, 0.46)'
                            : 'rgba(41, 98, 255, 0.54)'
                          : state.isLight
                          ? 'rgba(120, 123, 134, 0.22)'
                          : 'rgba(148, 163, 184, 0.18)';
                        if (isLeft) {
                          ctx.fillRect(anchorX, top, totalW, barH);
                        } else {
                          ctx.fillRect(anchorX - totalW, top, totalW, barH);
                        }
                      }
                    }
                    ctx.restore();

                    const drawnTagYs: number[] = [];
                    const drawVpTag = (label: string, yCoord: number, bgColor: string) => {
                      if (!vpCfg.showLabels) return;
                      for (const prevY of drawnTagYs) {
                        if (Math.abs(prevY - yCoord) < 16) return;
                      }
                      drawnTagYs.push(yCoord);
                      ctx.save();
                      ctx.font = '700 9.5px "JetBrains Mono", monospace';
                      const tw = ctx.measureText(label).width;
                      const padX = 5;
                      const tagW = tw + padX * 2;
                      const tagH = 15;
                      const tagX = isLeft
                        ? Math.min(plotW - tagW - 8, anchorX + maxBarW + 8)
                        : Math.max(8, anchorX - maxBarW - tagW - 8);
                      const tagY = Math.max(
                        4,
                        Math.min(mediaSize.height - tagH - 4, yCoord - tagH / 2)
                      );
                      drawRoundedRect(ctx, tagX, tagY, tagW, tagH, 4);
                      ctx.fillStyle = bgColor;
                      ctx.fill();
                      ctx.fillStyle = '#ffffff';
                      ctx.textAlign = 'left';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(label, tagX + padX, tagY + tagH / 2 + 0.5);
                      ctx.restore();
                    };

                    if (vpCfg.showValueArea) {
                      ctx.save();
                      ctx.setLineDash([5, 4]);
                      ctx.lineWidth = 1.25;
                      ctx.strokeStyle = state.isLight
                        ? 'rgba(41, 98, 255, 0.85)'
                        : 'rgba(56, 189, 248, 0.88)';
                      if (yVah !== null) {
                        const y = Number(yVah);
                        if (y >= -4 && y <= mediaSize.height + 4) {
                          ctx.beginPath();
                          ctx.moveTo(0, y);
                          ctx.lineTo(plotW, y);
                          ctx.stroke();
                        }
                      }
                      if (yVal !== null) {
                        const y = Number(yVal);
                        if (y >= -4 && y <= mediaSize.height + 4) {
                          ctx.beginPath();
                          ctx.moveTo(0, y);
                          ctx.lineTo(plotW, y);
                          ctx.stroke();
                        }
                      }
                      ctx.restore();
                    }

                    if (vpCfg.showPoc && yPoc !== null) {
                      const y = Number(yPoc);
                      if (y >= -4 && y <= mediaSize.height + 4) {
                        ctx.save();
                        ctx.strokeStyle = '#f23645';
                        ctx.lineWidth = 1.75;
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(plotW, y);
                        ctx.stroke();
                        ctx.restore();
                        drawVpTag(
                          `POC ${formatPrice(vp.pocPrice, state.symbolInfo.decimals)}`,
                          y,
                          'rgba(242, 54, 69, 0.92)'
                        );
                      }
                    }

                    if (vpCfg.showValueArea && yVah !== null) {
                      const y = Number(yVah);
                      if (y >= -4 && y <= mediaSize.height + 4) {
                        drawVpTag(
                          `VAH ${formatPrice(vp.vahPrice, state.symbolInfo.decimals)}`,
                          y,
                          'rgba(41, 98, 255, 0.9)'
                        );
                      }
                    }
                    if (vpCfg.showValueArea && yVal !== null) {
                      const y = Number(yVal);
                      if (y >= -4 && y <= mediaSize.height + 4) {
                        drawVpTag(
                          `VAL ${formatPrice(vp.valPrice, state.symbolInfo.decimals)}`,
                          y,
                          'rgba(41, 98, 255, 0.9)'
                        );
                      }
                    }
                }
              }
            });
          },
        };
      },
    };

    this._topView = {
      zOrder: (): PrimitivePaneViewZOrder => 'top',
      renderer: (): IPrimitivePaneRenderer | null => {
        const state = this._state;
        const chart = this._chart;
        const series = this._series;
        const preview = this._livePreview;
        if (!state || !chart || !series) return null;
        const hasAbsorption = Boolean(
          state.absorptionVisible && state.orderflowPoints && state.orderflowPoints.length > 0
        );
        if (
          state.drawings.length === 0 &&
          !preview.drawing &&
          !preview.snapPixel &&
          !hasAbsorption
        ) {
          return null;
        }

        return {
          draw: (target) => {
            target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
              const ts = chart.timeScale();
              const toCoords = (t: number, p: number) => ({
                x: timeToChartX(ts, state.candles, state.candleIntervalSec, t),
                y: (() => {
                  const py = series.priceToCoordinate(p);
                  return py !== null ? Number(py) : null;
                })(),
              });

              // On-chart Absorption Delta & CVD Divergence Markers
              if (state.absorptionVisible && state.orderflowPoints && state.orderflowPoints.length > 0) {
                let lastLabelX = -100;
                for (const pt of state.orderflowPoints) {
                  if (!pt.absorption && !pt.divergence) continue;
                  const x = timeToChartX(ts, state.candles, state.candleIntervalSec, pt.time);
                  if (x === null || x < -20 || x > mediaSize.width + 20) continue;

                  if (pt.absorption) {
                    const isBull = pt.absorption === 'bull';
                    const anchorPrice = isBull ? pt.low : pt.high;
                    const py = series.priceToCoordinate(anchorPrice);
                    if (py !== null) {
                      const yBase = Number(py);
                      const y = isBull ? yBase + 11 : yBase - 11;
                      const col = isBull ? '#089981' : '#f23645';
                      const r = Math.min(6.5, 4 + pt.absorptionStrength * 0.7);

                      ctx.save();
                      // Outer halo
                      ctx.beginPath();
                      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
                      ctx.fillStyle = isBull ? 'rgba(8, 153, 129, 0.18)' : 'rgba(242, 54, 69, 0.18)';
                      ctx.fill();

                      // Diamond marker
                      ctx.beginPath();
                      ctx.moveTo(x, y - r);
                      ctx.lineTo(x + r, y);
                      ctx.lineTo(x, y + r);
                      ctx.lineTo(x - r, y);
                      ctx.closePath();
                      ctx.fillStyle = col;
                      ctx.fill();
                      ctx.lineWidth = 1.1;
                      ctx.strokeStyle = '#ffffff';
                      ctx.stroke();

                      // Non-overlapping concise ABS badge when spacing allows
                      if (Math.abs(x - lastLabelX) >= 34) {
                        lastLabelX = x;
                        ctx.font = '700 8.5px monospace';
                        ctx.textAlign = 'center';
                        ctx.fillStyle = col;
                        ctx.fillText(
                          isBull ? 'ABS+' : 'ABS-',
                          x,
                          isBull ? y + r + 10 : y - r - 4
                        );
                      }
                      ctx.restore();
                    }
                  } else if (pt.divergence) {
                    const isBullDiv = pt.divergence === 'bull_div';
                    const py = series.priceToCoordinate(isBullDiv ? pt.low : pt.high);
                    if (py !== null) {
                      const y = Number(py) + (isBullDiv ? 8 : -8);
                      ctx.save();
                      ctx.beginPath();
                      ctx.arc(x, y, 3, 0, Math.PI * 2);
                      ctx.fillStyle = '#f59e0b';
                      ctx.fill();
                      ctx.restore();
                    }
                  }
                }
              }

              for (const d of state.drawings) {
                renderSingleDrawingCanvas(
                  ctx,
                  mediaSize.width,
                  mediaSize.height,
                  d,
                  state,
                  toCoords
                );
              }

              if (preview.drawing) {
                ctx.save();
                if (preview.isGhost) {
                  ctx.globalAlpha = 0.55;
                }
                renderSingleDrawingCanvas(
                  ctx,
                  mediaSize.width,
                  mediaSize.height,
                  preview.drawing,
                  state,
                  toCoords
                );
                ctx.restore();
              }

              if (preview.snapPixel) {
                const { x, y } = preview.snapPixel;
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(41, 98, 255, 0.16)';
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#2962ff';
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#2962ff';
                ctx.fill();
                ctx.restore();
              }
            });
          },
        };
      },
    };
  }

  public attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
    this._requestUpdate();
  }

  public detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  public paneViews(): readonly IPrimitivePaneView[] {
    return [this._bottomView, this._topView];
  }

  public setState(next: ChartOverlaysState): void {
    this._state = next;
    this._requestUpdate?.();
  }

  public setHoveredDrawingId(id: string | null): void {
    if (!this._state || this._state.hoveredDrawingId === id) return;
    this._state = { ...this._state, hoveredDrawingId: id };
    this._requestUpdate?.();
  }

  public setLivePreview(preview: LiveDrawingPreviewState): void {
    this._livePreview = preview;
    this._requestUpdate?.();
  }

  public clearLivePreview(): void {
    if (!this._livePreview.drawing && !this._livePreview.snapPixel) return;
    this._livePreview = { drawing: null, isGhost: false, snapPixel: null };
    this._requestUpdate?.();
  }
}
