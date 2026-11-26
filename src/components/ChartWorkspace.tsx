import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  BaselineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  Logical,
  LogicalRange,
  Time,
  IPriceLine,
} from 'lightweight-charts';
import {
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Settings,
  Zap,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  X,
  Info,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  SymbolInfo,
  CandleBar,
  formatPrice,
  formatTimeframeHeaderLabel,
  parseTimeframeToSeconds,
  toHeikinAshiCandles,
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  calculateBollingerBands,
  getInstitutionalIVWalls,
  getSupplyDemandZones,
  TradePosition,
  PriceAlert,
  calculatePositionPnL,
} from '../utils/marketEngine';
import {
  ChartStyleType,
  ChartSettingsConfig,
  DrawingPoint,
  DrawingToolId,
  ChartDrawing,
  IndicatorConfig,
  CompareOverlay,
  ChartGexOverlayLevel,
  GexChartOverlayConfig,
  GexDashboardData,
  VolumeProfileConfig,
  DEFAULT_VOLUME_PROFILE_CONFIG,
  resolveTimezoneIana,
  AppThemeConfig,
  DrawingTemplate,
} from '../types/trading';
import {
  applyShiftConstraint,
  computePeriodVolumeProfile,
  hasCompletePreviousPeriod,
  createDrawingFromPoints,
  getToolDisplayName,
  getToolPointMode,
  hitTestDrawings,
  isLineToolId,
  moveDrawingHandle,
  snapPriceToCandle,
  supportsRichTextTool,
  translateDrawing,
} from '../utils/drawingEngine';
import { FloatingFavoritesToolbar } from './FloatingFavoritesToolbar';
import {
  ChartOverlaysPrimitive,
  timeToChartX,
} from './ChartOverlaysPrimitive';
import { DrawingPropertiesBar } from './DrawingPropertiesBar';
import { DrawingSettingsModal, DrawingSettingsTab } from './DrawingSettingsModal';
import type { SettingsTabId } from './ChartSettingsModal';
import { computeBarOrderflow, summarizeOrderflow } from '../utils/orderflowEngine';
import { resolveEffectiveChartBgColor } from '../utils/themeEngine';
import { BarChart2, AlignRight } from 'lucide-react';

interface ChartWorkspaceProps {
  paneId?: string;
  isActivePane?: boolean;
  isMultiPane?: boolean;
  onFocusPane?: () => void;
  symbolInfo: SymbolInfo;
  timeframe: string;
  candles: CandleBar[];
  /** Called when the user scrolls to the oldest loaded bar so the parent can page in history. */
  onLoadOlderCandles?: () => void;
  chartStyle: ChartStyleType;
  chartCanvasTheme: 'light' | 'dark';
  appTheme?: AppThemeConfig;
  chartSettings?: ChartSettingsConfig;
  onOpenSettings?: (tab?: SettingsTabId) => void;
  syncedCrosshair?: { time: number; sourcePaneId: string } | null;
  onCrosshairSync?: (time: number | null) => void;
  syncedTimeRange?: { from: number; to: number; sourcePaneId: string } | null;
  onTimeRangeSync?: (range: { from: number; to: number } | null) => void;
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  favoriteToolIds: DrawingToolId[];
  magnetActive: boolean;
  stayInDrawingMode: boolean;
  drawingsLocked: boolean;
  drawingsHidden: boolean;
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string | null) => void;
  onAddDrawing: (drawing: ChartDrawing) => void;
  onUpdateDrawing: (drawing: ChartDrawing) => void;
  onCloneDrawing: (drawing: ChartDrawing) => void;
  onRemoveDrawing: (id: string) => void;
  onReorderDrawing?: (id: string, direction: 'front' | 'back') => void;
  drawingTemplates?: DrawingTemplate[];
  onSaveDrawingTemplate?: (template: DrawingTemplate) => void;
  favoritesBarVisible: boolean;
  indicators: IndicatorConfig[];
  onToggleIndicatorVisibility: (id: string) => void;
  onRemoveIndicator?: (id: string) => void;
  compareOverlays?: CompareOverlay[];
  onRemoveCompareOverlay?: (symbol: string) => void;
  positions: TradePosition[];
  onQuickOrder: (side: 'BUY' | 'SELL') => void;
  onClosePosition: (id: string) => void;
  alerts: PriceAlert[];
  replayActive: boolean;
  replayIndex: number;
  replayPlaying: boolean;
  onReplayTogglePlay: () => void;
  onReplayStep: () => void;
  onReplayExit: () => void;
  zoomTrigger: number;
  logScale: boolean;
  autoScale: boolean;
  onToggleLogScale?: () => void;
  onToggleAutoScale?: () => void;
  onOpenNewsDrawer: () => void;
  candleDataSource?: string;
  loadingCandles?: boolean;
  candlesError?: string | null;
  onRetryCandles?: () => void;
  timezoneId?: string;
  liveTickDeltas?: Record<number, number>;
  gexOverlayLevels?: ChartGexOverlayLevel[];
  gexData?: GexDashboardData | null;
  gexRawSpotPrice?: number | null;
  gexLoading?: boolean;
  gexError?: string | null;
  gexOverlayConfig?: GexChartOverlayConfig;
  gexIndicatorVisible?: boolean;
  gexResolvedInfo?: { underlying: string; isFuturesProxy: boolean } | null;
  gexSpotScaleRatio?: number;
  onToggleGexIndicator?: () => void;
  onUpdateGexConfig?: (patch: Partial<GexChartOverlayConfig>) => void;
  onRefreshGex?: () => void;
  onOpenGexModal?: () => void;
  volumeProfileConfig?: VolumeProfileConfig;
  onUpdateVolumeProfileConfig?: (patch: Partial<VolumeProfileConfig>) => void;
}

interface HoverBarData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  vwap?: number;
  delta?: number;
  cvd?: number;
  absorption?: 'bull' | 'bear' | null;
  x: number;
  y: number;
}

export const ChartWorkspace: React.FC<ChartWorkspaceProps> = ({
  paneId = 'pane-1',
  isActivePane = true,
  isMultiPane = false,
  onFocusPane,
  symbolInfo,
  timeframe,
  candles,
  onLoadOlderCandles,
  chartStyle,
  chartCanvasTheme,
  appTheme,
  chartSettings,
  onOpenSettings,
  syncedCrosshair,
  onCrosshairSync,
  syncedTimeRange,
  onTimeRangeSync,
  activeTool,
  onSelectTool,
  favoriteToolIds,
  magnetActive,
  stayInDrawingMode,
  drawingsLocked,
  drawingsHidden,
  drawings,
  selectedDrawingId,
  onSelectDrawing,
  onAddDrawing,
  onUpdateDrawing,
  onCloneDrawing,
  onRemoveDrawing,
  onReorderDrawing,
  drawingTemplates: controlledDrawingTemplates,
  onSaveDrawingTemplate: onSaveDrawingTemplateProp,
  favoritesBarVisible,
  indicators,
  onToggleIndicatorVisibility,
  onRemoveIndicator,
  compareOverlays = [],
  onRemoveCompareOverlay,
  positions,
  onQuickOrder,
  onClosePosition,
  alerts,
  replayActive,
  replayIndex,
  replayPlaying,
  onReplayTogglePlay,
  onReplayStep,
  onReplayExit,
  zoomTrigger,
  logScale,
  autoScale,
  onToggleLogScale,
  onToggleAutoScale,
  onOpenNewsDrawer,
  candleDataSource,
  loadingCandles = false,
  candlesError = null,
  onRetryCandles,
  timezoneId = 'America/New_York',
  liveTickDeltas,
  gexOverlayLevels = [],
  gexData = null,
  gexRawSpotPrice = null,
  gexLoading = false,
  gexError = null,
  gexOverlayConfig,
  gexIndicatorVisible = false,
  gexResolvedInfo = null,
  gexSpotScaleRatio = 1,
  onToggleGexIndicator,
  onUpdateGexConfig,
  onRefreshGex,
  onOpenGexModal,
  volumeProfileConfig = DEFAULT_VOLUME_PROFILE_CONFIG,
  onUpdateVolumeProfileConfig,
}) => {
  const isSecondsTf = useMemo(() => parseTimeframeToSeconds(timeframe) < 60, [timeframe]);
  const isSecondsTfRef = useRef(isSecondsTf);
  isSecondsTfRef.current = isSecondsTf;

  const resolvedIanaTz = useMemo(
    () => resolveTimezoneIana(timezoneId, symbolInfo.lseMarket),
    [timezoneId, symbolInfo.lseMarket]
  );
  const resolvedIanaTzRef = useRef(resolvedIanaTz);
  resolvedIanaTzRef.current = resolvedIanaTz;

  const formatTickInTz = useCallback(
    (unixSec: number, ianaTz: string, includeSeconds: boolean = false): string => {
      try {
        const date = new Date(unixSec * 1000);
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: ianaTz,
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: includeSeconds ? '2-digit' : undefined,
          hour12: true,
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
        const hour = get('hour');
        const minute = get('minute');
        const second = get('second');
        const dayPeriod = get('dayPeriod');
        if (!includeSeconds && hour === '12' && minute === '00' && dayPeriod === 'AM') {
          return String(Number(get('day')) || get('day'));
        }
        if (includeSeconds && second) {
          return `${hour}:${minute}:${second} ${dayPeriod}`;
        }
        return `${hour}:${minute} ${dayPeriod}`;
      } catch {
        const d = new Date(unixSec * 1000);
        const hh = d.getUTCHours();
        const mm = d.getUTCMinutes();
        const ss = d.getUTCSeconds();
        if (!includeSeconds && hh === 0 && mm === 0) return String(d.getUTCDate());
        const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
        const ampm = hh >= 12 ? 'PM' : 'AM';
        if (includeSeconds) {
          return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} ${ampm}`;
        }
        return `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${ampm}`;
      }
    },
    []
  );

  const formatCrosshairInTz = useCallback(
    (unixSec: number, ianaTz: string, includeSeconds: boolean = false): string => {
      try {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: ianaTz,
          month: 'short',
          day: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: includeSeconds ? '2-digit' : undefined,
          hour12: true,
        }).format(new Date(unixSec * 1000));
      } catch {
        return new Date(unixSec * 1000).toUTCString().slice(4, includeSeconds ? 25 : 22);
      }
    },
    []
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vwapSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emaSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const smaSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbUpperRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbMidRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbLowerRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderflowDeltaSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderflowCvdSeriesRef = useRef<ISeriesApi<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pivotLineRef = useRef<any>(null);
  const gexPriceLinesRef = useRef<IPriceLine[]>([]);
  const vpPriceLinesRef = useRef<IPriceLine[]>([]);
  const candleMapRef = useRef<Map<number, CandleBar>>(new Map());
  const seriesMetaRef = useRef<{ len: number; firstTime: number; lastTime: number }>({
    len: 0,
    firstTime: 0,
    lastTime: 0,
  });
  // Bumped after every chart instance rebuild so display settings are re-applied to the new series
  const [chartEpoch, setChartEpoch] = useState(0);
  const onLoadOlderCandlesRef = useRef(onLoadOlderCandles);
  onLoadOlderCandlesRef.current = onLoadOlderCandles;
  const lastHistoryRequestAtRef = useRef(0);

  const [legendExpanded, setLegendExpanded] = useState(true);
  const [hoverData, setHoverData] = useState<HoverBarData | null>(null);
  const [floatingTooltipEnabled, setFloatingTooltipEnabled] = useState(true);
  const [tooltipPinnedPos, setTooltipPinnedPos] = useState<{ x: number; y: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const isHoveringTooltipRef = useRef(false);
  const isDraggingTooltipRef = useRef(false);
  const frozenTooltipCoordsRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipDragRafRef = useRef<number | null>(null);
  const [currencyUnit, setCurrencyUnit] = useState(symbolInfo.currency || 'USD');
  const [scaleSettingsOpen, setScaleSettingsOpen] = useState(false);
  const [gexMenuOpen, setGexMenuOpen] = useState(false);
  const gexMenuRef = useRef<HTMLDivElement | null>(null);
  const [vpMenuOpen, setVpMenuOpen] = useState(false);
  const vpMenuRef = useRef<HTMLDivElement | null>(null);
  const [vpHistoryCache, setVpHistoryCache] = useState<
    Record<string, { candles: CandleBar[]; loading: boolean }>
  >({});
  const vpHistoryCacheRef = useRef(vpHistoryCache);
  vpHistoryCacheRef.current = vpHistoryCache;
  const [countdownText, setCountdownText] = useState('00:01');
  const [overlayTick, setOverlayTick] = useState(0);

  useEffect(() => {
    if (!gexMenuOpen && !vpMenuOpen) return;
    const onDocDown = (ev: MouseEvent) => {
      if (gexMenuOpen && gexMenuRef.current && !gexMenuRef.current.contains(ev.target as Node)) {
        setGexMenuOpen(false);
      }
      if (vpMenuOpen && vpMenuRef.current && !vpMenuRef.current.contains(ev.target as Node)) {
        setVpMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [gexMenuOpen, vpMenuOpen]);

  const effectiveDecimals = useMemo(() => {
    if (chartSettings?.precision && chartSettings.precision !== 'Default') {
      const parsed = parseInt(chartSettings.precision, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
    return symbolInfo.decimals;
  }, [chartSettings?.precision, symbolInfo.decimals]);

  const onCrosshairSyncRef = useRef(onCrosshairSync);
  onCrosshairSyncRef.current = onCrosshairSync;
  const onTimeRangeSyncRef = useRef(onTimeRangeSync);
  onTimeRangeSyncRef.current = onTimeRangeSync;
  const isApplyingSyncRangeRef = useRef(false);

  // Interactive drawing creation & editing refs (zero re-render on pointermove via native chart primitive)
  const primitiveRef = useRef<ChartOverlaysPrimitive | null>(null);
  const overlayRafRef = useRef<number | null>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const pendingMoveCoordsRef = useRef<{
    x: number;
    y: number;
    shiftKey?: boolean;
    ctrlKey?: boolean;
  } | null>(null);

  const draftPointsRef = useRef<DrawingPoint[]>([]);
  const freehandPointsRef = useRef<DrawingPoint[]>([]);
  const isFreehandDownRef = useRef<boolean>(false);
  const pressStartPxRef = useRef<{ x: number; y: number } | null>(null);
  const lastFreehandPxRef = useRef<{ x: number; y: number } | null>(null);
  const [draftStepCount, setDraftStepCount] = useState<number>(0);

  // Selection & handle/body dragging (only discrete start/end updates state)
  const [draggingDrawingId, setDraggingDrawingId] = useState<string | null>(null);
  const selectedDrawingIdRef = useRef<string | null>(selectedDrawingId);
  selectedDrawingIdRef.current = selectedDrawingId;
  const pendingSelectTapRef = useRef<{
    drawingId: string;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const liveDragDrawingRef = useRef<ChartDrawing | null>(null);
  const dragStateRef = useRef<{
    mode: 'handle' | 'body' | 'shift-measure';
    drawingId: string;
    handleIndex?: number;
    startChartPt: DrawingPoint;
    origDrawing: ChartDrawing;
  } | null>(null);

  // Inline floating text editor for annotations & labels
  const [editingTextDrawingId, setEditingTextDrawingId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');

  // Full TradingView Drawing Settings Modal (Style | Text | Coordinates | Visibility)
  const [drawingSettingsState, setDrawingSettingsState] = useState<{
    drawingId: string;
    tab: DrawingSettingsTab;
  } | null>(null);

  const [localDrawingTemplates, setLocalDrawingTemplates] = useState<DrawingTemplate[]>(() => {
    try {
      const raw = localStorage.getItem('quant_drawing_templates_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as DrawingTemplate[];
      }
    } catch {
      // ignore storage failure
    }
    return [];
  });

  useEffect(() => {
    if (controlledDrawingTemplates) return;
    try {
      localStorage.setItem('quant_drawing_templates_v1', JSON.stringify(localDrawingTemplates));
    } catch {
      // ignore storage failure
    }
  }, [localDrawingTemplates, controlledDrawingTemplates]);

  const drawingTemplates = controlledDrawingTemplates ?? localDrawingTemplates;

  // TradingView-style right-click context menu on drawings
  const [drawingContextMenu, setDrawingContextMenu] = useState<{
    x: number;
    y: number;
    drawingId: string;
  } | null>(null);

  useEffect(() => {
    if (!drawingContextMenu) return;
    const dismiss = () => setDrawingContextMenu(null);
    window.addEventListener('mousedown', dismiss);
    return () => window.removeEventListener('mousedown', dismiss);
  }, [drawingContextMenu]);

  // Slice candles if in Bar Replay mode
  const displayedCandles = useMemo(() => {
    if (!replayActive) return candles;
    const endIdx = Math.max(20, Math.min(candles.length, replayIndex));
    return candles.slice(0, endIdx);
  }, [candles, replayActive, replayIndex]);

  const currencyFactor = currencyUnit === 'EUR' ? 0.92 : 1;

  const processedCandles = useMemo(() => {
    const base =
      chartStyle === 'heikin_ashi'
        ? toHeikinAshiCandles(displayedCandles)
        : displayedCandles;
    if (currencyFactor === 1) return base;
    return base.map((c) => ({
      ...c,
      open: Number((c.open * currencyFactor).toFixed(symbolInfo.decimals)),
      high: Number((c.high * currencyFactor).toFixed(symbolInfo.decimals)),
      low: Number((c.low * currencyFactor).toFixed(symbolInfo.decimals)),
      close: Number((c.close * currencyFactor).toFixed(symbolInfo.decimals)),
    }));
  }, [displayedCandles, chartStyle, currencyFactor, symbolInfo.decimals]);

  const vwapMap = useMemo(() => {
    const vwapArr = calculateVWAP(processedCandles);
    const map = new Map<number, number>();
    for (const pt of vwapArr) {
      map.set(pt.time, pt.value);
    }
    return map;
  }, [processedCandles]);

  const ivWalls = useMemo(
    () => getInstitutionalIVWalls(symbolInfo, processedCandles),
    [symbolInfo, processedCandles]
  );
  const supplyDemandZones = useMemo(
    () => getSupplyDemandZones(symbolInfo, processedCandles),
    [symbolInfo, processedCandles]
  );

  const ivWallsVisible = useMemo(
    () => indicators.some((ind) => (ind.id === 'iv-walls-1' || ind.id === 'iv-walls-2') && ind.visible),
    [indicators]
  );

  const ssmtVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'ssmt-zones' && ind.visible),
    [indicators]
  );

  const vwapVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'vwap' && ind.visible),
    [indicators]
  );

  const emaVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'ema-20' && ind.visible),
    [indicators]
  );

  const sma50Visible = useMemo(
    () => indicators.some((ind) => ind.id === 'sma-50' && ind.visible),
    [indicators]
  );

  const bbVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'bb-20' && ind.visible),
    [indicators]
  );

  const volumeVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'volume' && ind.visible),
    [indicators]
  );

  const orderflowVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'orderflow-delta' && ind.visible),
    [indicators]
  );

  const absorptionVisible = useMemo(
    () => indicators.some((ind) => ind.id === 'absorption-delta' && ind.visible),
    [indicators]
  );

  const vpIndicatorEnabled = useMemo(
    () => indicators.some((ind) => ind.id === 'volume-profile' && ind.visible),
    [indicators]
  );
  const vpVisible = vpIndicatorEnabled && isActivePane;

  const chartCoversVpPeriod = useMemo(
    () =>
      !isSecondsTf &&
      hasCompletePreviousPeriod(processedCandles, volumeProfileConfig.periodMode, resolvedIanaTz),
    [isSecondsTf, processedCandles, volumeProfileConfig.periodMode, resolvedIanaTz]
  );

  const vpHistoryKey = `${symbolInfo.symbol}__${symbolInfo.lseMarket}__${symbolInfo.lseHttpSymbol}__${volumeProfileConfig.periodMode}`;

  useEffect(() => {
    if (!vpVisible || chartCoversVpPeriod) return;
    const existing = vpHistoryCacheRef.current[vpHistoryKey];
    if (existing && (existing.loading || existing.candles.length > 0)) return;

    const controller = new AbortController();
    const fetchTf = volumeProfileConfig.periodMode === 'prev_week' ? '15m' : '5m';
    const fetchRange = volumeProfileConfig.periodMode === 'prev_week' ? '1M' : '5D';

    setVpHistoryCache((prev) => ({
      ...prev,
      [vpHistoryKey]: { candles: prev[vpHistoryKey]?.candles ?? [], loading: true },
    }));

    const qs = new URLSearchParams({
      symbol: symbolInfo.symbol,
      market: symbolInfo.lseMarket || '',
      httpSymbol: symbolInfo.lseHttpSymbol || symbolInfo.symbol,
      timeframe: fetchTf,
      range: fetchRange,
    });

    fetch(`/api/market/candles?${qs.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (controller.signal.aborted) return;
        const bars = Array.isArray(data?.candles) ? (data.candles as CandleBar[]) : [];
        setVpHistoryCache((prev) => ({
          ...prev,
          [vpHistoryKey]: { candles: bars, loading: false },
        }));
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setVpHistoryCache((prev) => ({
          ...prev,
          [vpHistoryKey]: { candles: [], loading: false },
        }));
      });

    return () => controller.abort();
  }, [
    vpVisible,
    chartCoversVpPeriod,
    vpHistoryKey,
    volumeProfileConfig.periodMode,
    symbolInfo.symbol,
    symbolInfo.lseMarket,
    symbolInfo.lseHttpSymbol,
  ]);

  const vpHistoryEntry = vpHistoryCache[vpHistoryKey];
  const vpHistoryLoading = Boolean(vpVisible && !chartCoversVpPeriod && vpHistoryEntry?.loading);

  const periodVolumeProfile = useMemo(() => {
    if (!vpVisible) return null;
    const rawExternal = vpHistoryEntry?.candles;
    let sourceBars: CandleBar[] = processedCandles;
    if (!chartCoversVpPeriod && rawExternal && rawExternal.length > 0) {
      sourceBars =
        currencyFactor === 1
          ? rawExternal
          : rawExternal.map((c) => ({
              ...c,
              open: Number((c.open * currencyFactor).toFixed(symbolInfo.decimals)),
              high: Number((c.high * currencyFactor).toFixed(symbolInfo.decimals)),
              low: Number((c.low * currencyFactor).toFixed(symbolInfo.decimals)),
              close: Number((c.close * currencyFactor).toFixed(symbolInfo.decimals)),
            }));
    }
    if (sourceBars.length === 0) return null;
    return computePeriodVolumeProfile(
      sourceBars,
      volumeProfileConfig.periodMode,
      volumeProfileConfig.rowCount,
      volumeProfileConfig.valueAreaPct,
      resolvedIanaTz
    );
  }, [
    vpVisible,
    chartCoversVpPeriod,
    vpHistoryEntry?.candles,
    processedCandles,
    currencyFactor,
    symbolInfo.decimals,
    volumeProfileConfig.periodMode,
    volumeProfileConfig.rowCount,
    volumeProfileConfig.valueAreaPct,
    resolvedIanaTz,
  ]);

  const orderflowPoints = useMemo(
    () => computeBarOrderflow(processedCandles, liveTickDeltas),
    [processedCandles, liveTickDeltas]
  );

  const orderflowMap = useMemo(() => {
    const map = new Map<number, (typeof orderflowPoints)[number]>();
    for (const pt of orderflowPoints) {
      map.set(pt.time, pt);
    }
    return map;
  }, [orderflowPoints]);

  const orderflowMapRef = useRef(orderflowMap);
  orderflowMapRef.current = orderflowMap;

  const orderflowSummary = useMemo(
    () => summarizeOrderflow(orderflowPoints),
    [orderflowPoints]
  );

  // Live candle countdown timer (supports seconds & intraday bars)
  useEffect(() => {
    const tfSec = Math.max(1, parseTimeframeToSeconds(timeframe));
    const updateCountdown = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const bucketSec = Math.min(86400, tfSec);
      const rem = bucketSec - 1 - (nowSec % bucketSec);
      const hrs = Math.floor(rem / 3600);
      const mm = String(Math.floor((rem % 3600) / 60)).padStart(2, '0');
      const ss = String(rem % 60).padStart(2, '0');
      setCountdownText(hrs > 0 ? `${String(hrs).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [timeframe]);

  // Trigger HTML price-scale badge re-render when chart pans/zooms/scales (rAF-coalesced)
  const refreshOverlay = useCallback(() => {
    if (overlayRafRef.current !== null) return;
    overlayRafRef.current = requestAnimationFrame(() => {
      overlayRafRef.current = null;
      setOverlayTick((t) => t + 1);
    });
  }, []);

  // Build & configure lightweight-charts v5 instance
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const isLight = chartCanvasTheme === 'light';
    const baseBg = appTheme?.chartBg || (isLight ? '#ffffff' : '#0f1219');
    const bgColor = resolveEffectiveChartBgColor(appTheme, baseBg);
    const textColor = appTheme?.textMuted || (isLight ? '#787b86' : '#868993');
    const gridColor = appTheme?.chartGridColor || (isLight ? '#f2f4f8' : '#181c27');
    const borderColor = appTheme?.borderColor || (isLight ? '#e0e3eb' : '#222631');

    const chart = createChart(el, {
      width: el.clientWidth || 1000,
      height: el.clientHeight || 620,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: gridColor, style: LineStyle.Solid },
        horzLines: { color: gridColor, style: LineStyle.Solid },
      },
      crosshair: {
        mode: magnetActive ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal,
        vertLine: {
          color: isLight ? '#9598a1' : '#5d606b',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#363a45',
        },
        horzLine: {
          color: isLight ? '#9598a1' : '#5d606b',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#363a45',
        },
      },
      rightPriceScale: {
        borderColor,
        scaleMargins: {
          top: 0.04,
          bottom: 0.06,
        },
        mode: logScale ? 1 : 0,
        autoScale,
      },
      localization: {
        priceFormatter: (p: number) => formatPrice(p, effectiveDecimals),
        timeFormatter: (time: Time) =>
          formatCrosshairInTz(Number(time), resolvedIanaTzRef.current, isSecondsTfRef.current),
      },
      timeScale: {
        borderColor,
        timeVisible: true,
        secondsVisible: isSecondsTf,
        rightOffset: 14,
        barSpacing: 3.4,
        minBarSpacing: 1.2,
        tickMarkFormatter: (time: Time) =>
          formatTickInTz(Number(time), resolvedIanaTzRef.current, isSecondsTfRef.current),
      },
    });

    chartRef.current = chart;

    // Infinite history: ask the parent for older bars once the user scrolls near the left edge
    const requestOlderBars = (range: LogicalRange | null) => {
      if (!range || range.from > 2) return;
      const now = Date.now();
      // Cooldown so a single pan gesture cannot queue several history pages at once
      if (now - lastHistoryRequestAtRef.current < 800) return;
      lastHistoryRequestAtRef.current = now;
      onLoadOlderCandlesRef.current?.();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(requestOlderBars);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mainSeries: ISeriesApi<any>;

    if (chartStyle === 'bars') {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: isLight ? '#434651' : '#26a69a',
        downColor: isLight ? '#434651' : '#ef5350',
        thinBars: false,
        lastValueVisible: false,
        priceLineVisible: true,
        priceLineColor: '#9598a1',
        priceLineStyle: LineStyle.Dotted,
      });
    } else if (chartStyle === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#2962ff',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: true,
      });
    } else if (chartStyle === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: '#2962ff',
        topColor: 'rgba(41, 98, 255, 0.28)',
        bottomColor: 'rgba(41, 98, 255, 0.02)',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: true,
      });
    } else if (chartStyle === 'baseline') {
      const baseRef =
        symbolInfo.dayOpen > 0 ? symbolInfo.dayOpen : processedCandles[0]?.open ?? 0;
      mainSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: baseRef * currencyFactor },
        topLineColor: '#089981',
        bottomLineColor: '#f23645',
        lastValueVisible: false,
        priceLineVisible: true,
      });
    } else {
      // 'candles', 'hollow_candles', 'heikin_ashi'
      const themeBull = appTheme?.bullColor || '#089981';
      const themeBear = appTheme?.bearColor || '#f23645';
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: isLight
          ? chartStyle === 'hollow_candles'
            ? 'transparent'
            : themeBull
          : themeBull,
        downColor: themeBear,
        borderVisible: true,
        borderUpColor: themeBull,
        borderDownColor: themeBear,
        wickUpColor: themeBull,
        wickDownColor: themeBear,
        lastValueVisible: false,
        priceLineVisible: true,
        priceLineColor: '#9598a1',
        priceLineStyle: LineStyle.Dotted,
      });
    }

    mainSeriesRef.current = mainSeries;

    // Attach synchronous Canvas ISeriesPrimitive so drawings & institutional zones lock 1:1 with candles on every frame
    const primitive = new ChartOverlaysPrimitive();
    mainSeries.attachPrimitive(primitive);
    primitiveRef.current = primitive;
    primitive.setState({
      candles: processedCandles,
      candleIntervalSec:
        processedCandles.length >= 2
          ? Math.max(
              1,
              processedCandles[processedCandles.length - 1].time -
                processedCandles[processedCandles.length - 2].time
            )
          : 60,
      symbolInfo,
      isLight,
      ssmtVisible,
      ivWallsVisible,
      supplyDemandZones,
      ivWalls,
      drawings: drawingsHidden
        ? []
        : drawings.filter(
            (d) =>
              d.symbol === symbolInfo.symbol &&
              d.id !== draggingDrawingId &&
              (!d.visibleTimeframes ||
                d.visibleTimeframes.length === 0 ||
                d.visibleTimeframes.includes(timeframe))
          ),
      selectedDrawingId,
      hoveredDrawingId: null,
      volumeProfileVisible: vpVisible,
      volumeProfileConfig,
      volumeProfileData: periodVolumeProfile,
    });

    if (
      chartStyle === 'line' ||
      chartStyle === 'area' ||
      chartStyle === 'baseline'
    ) {
      mainSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          value: c.close,
        }))
      );
    } else {
      mainSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    }

    seriesMetaRef.current = {
      len: processedCandles.length,
      firstTime: processedCandles[0]?.time ?? 0,
      lastTime: processedCandles[processedCandles.length - 1]?.time ?? 0,
    };

    // Optional Volume Histogram
    if (volumeVisible) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.84, bottom: 0 },
      });
      volSeries.setData(
        processedCandles.map((c) => ({
          time: c.time as Time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)',
        }))
      );
      volSeriesRef.current = volSeries;
    }

    // Optional Session VWAP Line
    if (vwapVisible) {
      const vwapSeries = chart.addSeries(LineSeries, {
        color: '#ff9800',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const vwapData = calculateVWAP(processedCandles);
      vwapSeries.setData(vwapData.map((d) => ({ time: d.time as Time, value: d.value })));
      vwapSeriesRef.current = vwapSeries;
    }

    // Optional EMA 20 Line
    if (emaVisible) {
      const emaSeries = chart.addSeries(LineSeries, {
        color: '#2962ff',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const emaData = calculateEMA(processedCandles, 20);
      emaSeries.setData(emaData.map((d) => ({ time: d.time as Time, value: d.value })));
      emaSeriesRef.current = emaSeries;
    }

    // Optional SMA 50 Line
    if (sma50Visible) {
      const smaSeries = chart.addSeries(LineSeries, {
        color: '#e040fb',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const smaData = calculateSMA(processedCandles, 50);
      smaSeries.setData(smaData.map((d) => ({ time: d.time as Time, value: d.value })));
      smaSeriesRef.current = smaSeries;
    }

    // Optional Bollinger Bands (20, 2)
    if (bbVisible) {
      const bb = calculateBollingerBands(processedCandles, 20, 2);
      const bbUpper = chart.addSeries(LineSeries, {
        color: '#26a69a',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const bbMid = chart.addSeries(LineSeries, {
        color: '#787b86',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      const bbLower = chart.addSeries(LineSeries, {
        color: '#26a69a',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      bbUpper.setData(bb.upper.map((d) => ({ time: d.time as Time, value: d.value })));
      bbMid.setData(bb.middle.map((d) => ({ time: d.time as Time, value: d.value })));
      bbLower.setData(bb.lower.map((d) => ({ time: d.time as Time, value: d.value })));
      bbUpperRef.current = bbUpper;
      bbMidRef.current = bbMid;
      bbLowerRef.current = bbLower;
    }

    // Compare Overlays (each rendered on an independent hidden price scale so scales never crush the main chart)
    for (const ov of compareOverlays) {
      if (!ov.candles || ov.candles.length === 0) continue;
      const scaleId = `compare-${ov.symbol}`;
      const ovSeries = chart.addSeries(LineSeries, {
        color: ov.color,
        lineWidth: 2,
        priceScaleId: scaleId,
        lastValueVisible: true,
        priceLineVisible: false,
        title: ov.symbol,
      });
      ovSeries.priceScale().applyOptions({
        visible: false,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      });
      ovSeries.setData(
        ov.candles.map((pt) => ({ time: pt.time as Time, value: pt.close * currencyFactor }))
      );
    }

    // Orderflow Sub-Pane: Bar Volume Delta Histogram + Absorption Highlight + Cumulative Volume Delta (CVD) Line
    if (orderflowVisible) {
      try {
        const mainPane = chart.panes()[0];
        if (mainPane) mainPane.setStretchFactor(0.72);
        const ofPane = chart.addPane();
        ofPane.setStretchFactor(0.28);

        const deltaHist = ofPane.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          lastValueVisible: true,
          priceLineVisible: false,
          title: 'Bar Δ',
        });
        deltaHist.setData(
          orderflowPoints.map((pt) => ({
            time: pt.time as Time,
            value: pt.delta,
            color:
              pt.absorption === 'bull'
                ? '#10b981'
                : pt.absorption === 'bear'
                ? '#ff3b5c'
                : pt.delta >= 0
                ? 'rgba(8, 153, 129, 0.72)'
                : 'rgba(242, 54, 69, 0.72)',
          }))
        );
        orderflowDeltaSeriesRef.current = deltaHist;

        const cvdLine = ofPane.addSeries(LineSeries, {
          priceScaleId: 'cvd-scale',
          color: '#2962ff',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: false,
          title: 'CVD',
        });
        cvdLine.priceScale().applyOptions({
          visible: false,
          scaleMargins: { top: 0.12, bottom: 0.12 },
        });
        cvdLine.setData(
          orderflowPoints.map((pt) => ({
            time: pt.time as Time,
            value: pt.cvd,
          }))
        );
        orderflowCvdSeriesRef.current = cvdLine;
      } catch {
        // Fallback safely if pane creation throws during rapid unmount
      }
    }

    // Add Horizontal Pivot Line from computed dynamic IV WALLS
    if (ivWallsVisible && ivWalls.length > 0) {
      const pivotWall = ivWalls[0];
      pivotLineRef.current = mainSeries.createPriceLine({
        price: pivotWall.price,
        color: '#434651',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
        title: '',
      });
    }

    // Populate mutable bar map for crosshair lookup
    const candleByTime = new Map<number, CandleBar>();
    for (let i = 0; i < processedCandles.length; i++) {
      candleByTime.set(processedCandles[i].time, processedCandles[i]);
    }
    candleMapRef.current = candleByTime;

    chart.subscribeCrosshairMove((param) => {
      if (isHoveringTooltipRef.current || isDraggingTooltipRef.current) {
        return;
      }
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setHoverData(null);
        onCrosshairSyncRef.current?.(null);
        return;
      }
      const t = Number(param.time);
      onCrosshairSyncRef.current?.(Number.isFinite(t) ? t : null);
      const bar = candleMapRef.current.get(t);
      if (bar) {
        const chg = bar.close - bar.open;
        const chgPct = bar.open !== 0 ? (chg / bar.open) * 100 : 0;
        const ofPt = orderflowMapRef.current.get(bar.time);
        setHoverData({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
          volume: bar.volume,
          change: chg,
          changePercent: chgPct,
          vwap: vwapMap.get(bar.time),
          delta: ofPt?.delta,
          cvd: ofPt?.cvd,
          absorption: ofPt?.absorption,
          x: param.point.x,
          y: param.point.y,
        });
      }
    });

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      refreshOverlay();
      if (!isApplyingSyncRangeRef.current && range) {
        onTimeRangeSyncRef.current?.({ from: range.from, to: range.to });
      }
    });
    chart.timeScale().subscribeSizeChange(refreshOverlay);

    if (processedCandles.length > 195) {
      chart.timeScale().setVisibleLogicalRange({
        from: processedCandles.length - 195,
        to: processedCandles.length + 14,
      });
    } else if (processedCandles.length > 0) {
      chart.timeScale().fitContent();
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          chart.applyOptions({ width, height });
          containerRectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
          refreshOverlay();
        }
      }
    });
    resizeObserver.observe(el);
    containerRectRef.current = containerRef.current?.getBoundingClientRect() ?? null;

    // Force the settings effect to re-apply colours/scale options to the freshly built series
    setChartEpoch((epoch) => epoch + 1);

    const initTimer = setTimeout(refreshOverlay, 60);

    return () => {
      clearTimeout(initTimer);
      if (overlayRafRef.current !== null) {
        cancelAnimationFrame(overlayRafRef.current);
        overlayRafRef.current = null;
      }
      resizeObserver.disconnect();
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(requestOlderBars);
      } catch {
        // Ignore if chart already torn down
      }
      try {
        mainSeries.detachPrimitive(primitive);
      } catch {
        // Ignore if chart already tore down
      }
      primitiveRef.current = null;
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volSeriesRef.current = null;
      vwapSeriesRef.current = null;
      emaSeriesRef.current = null;
      smaSeriesRef.current = null;
      bbUpperRef.current = null;
      bbMidRef.current = null;
      bbLowerRef.current = null;
      orderflowDeltaSeriesRef.current = null;
      orderflowCvdSeriesRef.current = null;
      pivotLineRef.current = null;
      gexPriceLinesRef.current = [];
      vpPriceLinesRef.current = [];
      seriesMetaRef.current = { len: 0, firstTime: 0, lastTime: 0 };
    };
  }, [
    symbolInfo.symbol,
    chartStyle,
    chartCanvasTheme,
    magnetActive,
    logScale,
    autoScale,
    currencyUnit,
    ivWallsVisible,
    vwapVisible,
    emaVisible,
    sma50Visible,
    bbVisible,
    volumeVisible,
    orderflowVisible,
    compareOverlays,
  ]);

  // Synchronize incoming LSE REST candle reloads OR in-place live WebSocket tick updates
  useEffect(() => {
    const series = mainSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || processedCandles.length === 0) return;

    const map = new Map<number, CandleBar>();
    for (let i = 0; i < processedCandles.length; i++) {
      map.set(processedCandles[i].time, processedCandles[i]);
    }
    candleMapRef.current = map;

    const firstTime = processedCandles[0].time;
    const lastBar = processedCandles[processedCandles.length - 1];
    const prev = seriesMetaRef.current;

    const isIncrementalAppend =
      prev.len > 0 &&
      firstTime === prev.firstTime &&
      processedCandles.length === prev.len + 1 &&
      lastBar.time > prev.lastTime;

    const isInPlaceUpdate =
      prev.len > 0 &&
      firstTime === prev.firstTime &&
      processedCandles.length === prev.len &&
      lastBar.time === prev.lastTime;

    const needsFullReset = !isIncrementalAppend && !isInPlaceUpdate;

    // If the previously loaded data is still part of the new array, this is an incremental
    // prepend/append rather than a genuine reload: the user's viewport must not move.
    const previousFirstIndex =
      prev.len > 0 ? processedCandles.findIndex((c) => c.time === prev.firstTime) : -1;
    const prependCount = previousFirstIndex > 0 ? previousFirstIndex : 0;
    const visibleRangeBefore =
      previousFirstIndex >= 0 ? chart.timeScale().getVisibleLogicalRange() : null;

    try {
      if (chartSettings?.colorBarsOnPrevClose && chartStyle !== 'line' && chartStyle !== 'area' && chartStyle !== 'baseline') {
        const upBody = chartSettings.showBody
          ? chartSettings.useCustomCandleColors
            ? chartSettings.bodyUpColor
            : isLight
            ? '#ffffff'
            : '#089981'
          : 'transparent';
        const downBody = chartSettings.showBody
          ? chartSettings.useCustomCandleColors
            ? chartSettings.bodyDownColor
            : isLight
            ? '#434651'
            : '#f23645'
          : 'transparent';
        const upBorder = chartSettings.useCustomCandleColors
          ? chartSettings.borderUpColor
          : isLight
          ? '#434651'
          : '#089981';
        const downBorder = chartSettings.useCustomCandleColors
          ? chartSettings.borderDownColor
          : isLight
          ? '#434651'
          : '#f23645';
        const prevColoredData = processedCandles.map((c, idx) => {
          const prevClose = idx > 0 ? processedCandles[idx - 1].close : c.open;
          const up = c.close >= prevClose;
          return {
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            color: up ? upBody : downBody,
            borderColor: up ? upBorder : downBorder,
            wickColor: up ? upBorder : downBorder,
          };
        });
        series.setData(prevColoredData);
      } else if (needsFullReset) {
        if (
          chartStyle === 'line' ||
          chartStyle === 'area' ||
          chartStyle === 'baseline'
        ) {
          series.setData(
            processedCandles.map((c) => ({
              time: c.time as Time,
              value: c.close,
            }))
          );
        } else {
          series.setData(
            processedCandles.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );
        }
        if (visibleRangeBefore) {
          // Prepended bars shift every logical index; appended bars do not.
          chart.timeScale().setVisibleLogicalRange({
            from: visibleRangeBefore.from + prependCount,
            to: visibleRangeBefore.to + prependCount,
          });
        } else if (processedCandles.length > 195) {
          chart.timeScale().setVisibleLogicalRange({
            from: processedCandles.length - 195,
            to: processedCandles.length + 14,
          });
        } else {
          chart.timeScale().fitContent();
        }
      } else {
        if (
          chartStyle === 'line' ||
          chartStyle === 'area' ||
          chartStyle === 'baseline'
        ) {
          series.update({
            time: lastBar.time as Time,
            value: lastBar.close,
          });
        } else {
          series.update({
            time: lastBar.time as Time,
            open: lastBar.open,
            high: lastBar.high,
            low: lastBar.low,
            close: lastBar.close,
          });
        }
      }
      seriesMetaRef.current = {
        len: processedCandles.length,
        firstTime,
        lastTime: lastBar.time,
      };

      // Keep enabled overlays & volume in sync with updated/reloaded candles
      if (volSeriesRef.current) {
        volSeriesRef.current.setData(
          processedCandles.map((c) => ({
            time: c.time as Time,
            value: c.volume,
            color: c.close >= c.open ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)',
          }))
        );
      }
      if (vwapSeriesRef.current) {
        const vwapData = calculateVWAP(processedCandles);
        vwapSeriesRef.current.setData(vwapData.map((d) => ({ time: d.time as Time, value: d.value })));
      }
      if (emaSeriesRef.current) {
        const emaData = calculateEMA(processedCandles, 20);
        emaSeriesRef.current.setData(emaData.map((d) => ({ time: d.time as Time, value: d.value })));
      }
      if (smaSeriesRef.current) {
        const smaData = calculateSMA(processedCandles, 50);
        smaSeriesRef.current.setData(smaData.map((d) => ({ time: d.time as Time, value: d.value })));
      }
      if (bbUpperRef.current && bbMidRef.current && bbLowerRef.current) {
        const bb = calculateBollingerBands(processedCandles, 20, 2);
        bbUpperRef.current.setData(bb.upper.map((d) => ({ time: d.time as Time, value: d.value })));
        bbMidRef.current.setData(bb.middle.map((d) => ({ time: d.time as Time, value: d.value })));
        bbLowerRef.current.setData(bb.lower.map((d) => ({ time: d.time as Time, value: d.value })));
      }
      if (pivotLineRef.current && ivWalls.length > 0) {
        pivotLineRef.current.applyOptions({ price: ivWalls[0].price });
      }
      if (orderflowDeltaSeriesRef.current && orderflowCvdSeriesRef.current) {
        orderflowDeltaSeriesRef.current.setData(
          orderflowPoints.map((pt) => ({
            time: pt.time as Time,
            value: pt.delta,
            color:
              pt.absorption === 'bull'
                ? '#10b981'
                : pt.absorption === 'bear'
                ? '#ff3b5c'
                : pt.delta >= 0
                ? 'rgba(8, 153, 129, 0.72)'
                : 'rgba(242, 54, 69, 0.72)',
          }))
        );
        orderflowCvdSeriesRef.current.setData(
          orderflowPoints.map((pt) => ({
            time: pt.time as Time,
            value: pt.cvd,
          }))
        );
      }
      if (needsFullReset && autoScale) {
        chart.priceScale('right').applyOptions({ autoScale: true });
      }

      refreshOverlay();
    } catch {
      // Safe guard if series was just recreated
    }
  }, [processedCandles, orderflowPoints, chartStyle, refreshOverlay, ivWalls, autoScale, chartSettings?.colorBarsOnPrevClose, chartSettings?.showBody, chartSettings?.useCustomCandleColors, chartSettings?.bodyUpColor, chartSettings?.bodyDownColor, chartSettings?.borderUpColor, chartSettings?.borderDownColor, chartCanvasTheme]);

  // Apply ChartSettingsConfig live without tearing down the chart instance
  useEffect(() => {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series) return;

    const isLightTheme = chartCanvasTheme === 'light';
    const customCanvas = Boolean(chartSettings?.useCustomCanvasColors);
    const bgPrimary = customCanvas && chartSettings
      ? chartSettings.bgColor
      : appTheme?.chartBg || (isLightTheme ? '#ffffff' : '#0f1219');
    const effectiveBgPrimary = resolveEffectiveChartBgColor(appTheme, bgPrimary);
    const bgBottom = customCanvas && chartSettings
      ? chartSettings.bgColorBottom
      : appTheme?.appBg || (isLightTheme ? '#f4f6fa' : '#0a0d14');
    const vertColor = customCanvas && chartSettings
      ? chartSettings.vertGridColor
      : appTheme?.chartGridColor || (isLightTheme ? '#f2f4f8' : '#181c27');
    const horzColor = customCanvas && chartSettings
      ? chartSettings.horzGridColor
      : appTheme?.chartGridColor || (isLightTheme ? '#f2f4f8' : '#181c27');
    const textCol = customCanvas && chartSettings
      ? chartSettings.scalesTextColor
      : appTheme?.textMuted || (isLightTheme ? '#787b86' : '#868993');
    const lineCol = customCanvas && chartSettings
      ? chartSettings.scalesLinesColor
      : appTheme?.borderColor || (isLightTheme ? '#e0e3eb' : '#222631');
    const crossCol = customCanvas && chartSettings
      ? chartSettings.crosshairColor
      : isLightTheme
      ? '#64748b'
      : '#5d606b';
    const crossStyle =
      chartSettings?.crosshairStyle === 'solid'
        ? LineStyle.Solid
        : chartSettings?.crosshairStyle === 'dotted'
        ? LineStyle.Dotted
        : LineStyle.Dashed;

    const placeLeft = chartSettings?.scalesPlacement === 'Left';

    try {
      chart.applyOptions({
        layout: {
          background:
            customCanvas && chartSettings?.bgType === 'Gradient'
              ? {
                  type: ColorType.VerticalGradient,
                  topColor: resolveEffectiveChartBgColor(appTheme, bgPrimary),
                  bottomColor: resolveEffectiveChartBgColor(appTheme, bgBottom),
                }
              : { type: ColorType.Solid, color: effectiveBgPrimary },
          textColor: textCol,
          fontSize: chartSettings?.scalesFontSize ?? 11,
        },
        localization: {
          priceFormatter: (p: number) => formatPrice(p, effectiveDecimals),
          timeFormatter: (time: Time) =>
            formatCrosshairInTz(Number(time), resolvedIanaTz, isSecondsTf),
        },
        grid: {
          vertLines: {
            visible: chartSettings?.vertGridLines ?? true,
            color: vertColor,
            style: LineStyle.Solid,
          },
          horzLines: {
            visible: chartSettings?.horzGridLines ?? true,
            color: horzColor,
            style: LineStyle.Solid,
          },
        },
        crosshair: {
          mode: magnetActive ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal,
          vertLine: { color: crossCol, style: crossStyle, labelBackgroundColor: '#363a45' },
          horzLine: { color: crossCol, style: crossStyle, labelBackgroundColor: '#363a45' },
        },
        leftPriceScale: {
          visible: placeLeft,
          borderColor: lineCol,
          mode: logScale ? 1 : 0,
          autoScale,
        },
        rightPriceScale: {
          visible: !placeLeft,
          borderColor: lineCol,
          mode: logScale ? 1 : 0,
          autoScale,
        },
        timeScale: {
          borderColor: lineCol,
          secondsVisible: isSecondsTf,
          tickMarkFormatter: (time: Time) =>
            formatTickInTz(Number(time), resolvedIanaTz, isSecondsTf),
        },
      });

      if (chartStyle === 'candles' || chartStyle === 'hollow_candles' || chartStyle === 'heikin_ashi') {
        const customCandle = Boolean(chartSettings?.useCustomCandleColors);
        const themeBull = appTheme?.bullColor || (isLightTheme ? '#089981' : '#089981');
        const themeBear = appTheme?.bearColor || (isLightTheme ? '#f23645' : '#f23645');
        const upColor =
          chartSettings?.showBody === false
            ? 'transparent'
            : customCandle && chartSettings
            ? chartSettings.bodyUpColor
            : chartStyle === 'hollow_candles'
            ? 'transparent'
            : themeBull;
        const downColor =
          chartSettings?.showBody === false
            ? 'transparent'
            : customCandle && chartSettings
            ? chartSettings.bodyDownColor
            : themeBear;
        series.applyOptions({
          upColor,
          downColor,
          borderVisible: chartSettings?.showBorders ?? true,
          borderUpColor: customCandle && chartSettings ? chartSettings.borderUpColor : themeBull,
          borderDownColor: customCandle && chartSettings ? chartSettings.borderDownColor : themeBear,
          wickVisible: chartSettings?.showWick ?? true,
          wickUpColor: customCandle && chartSettings ? chartSettings.wickUpColor : themeBull,
          wickDownColor: customCandle && chartSettings ? chartSettings.wickDownColor : themeBear,
          priceLineVisible: chartSettings?.lastPriceLineVisible ?? true,
          priceLineColor: chartSettings?.lastPriceColor || '#9598a1',
        });
      }
    } catch {
      // ignore during unmount
    }
  }, [chartSettings, chartCanvasTheme, chartEpoch, appTheme?.chartBgOpacity, appTheme?.wallpaperMode, appTheme?.chartBg, appTheme?.chartGridColor, appTheme?.textMuted, appTheme?.borderColor, appTheme?.appBg, appTheme?.isLight, appTheme?.bullColor, appTheme?.bearColor, magnetActive, logScale, autoScale, effectiveDecimals, chartStyle, resolvedIanaTz, isSecondsTf, formatTickInTz, formatCrosshairInTz]);

  // Render pinned 0DTE GEX price lines (Call Wall, Put Wall, Zero Gamma, Max Pin) on matching underlying chart
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;

    for (const line of gexPriceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // ignore if already removed
      }
    }
    gexPriceLinesRef.current = [];

    const activeUpper = symbolInfo.symbol.toUpperCase();
    const httpUpper = symbolInfo.lseHttpSymbol.toUpperCase();
    const matching = gexOverlayLevels.filter(
      (lvl) =>
        lvl.price > 0 &&
        (lvl.underlying.toUpperCase() === activeUpper ||
          lvl.underlying.toUpperCase() === httpUpper)
    );

    const created: IPriceLine[] = [];
    for (const lvl of matching) {
      try {
        const line = series.createPriceLine({
          price: Number((lvl.price * currencyFactor).toFixed(effectiveDecimals)),
          color: lvl.color,
          lineWidth: (lvl.lineWidth === 1 ? 1 : 2) as 1 | 2,
          lineStyle:
            lvl.lineStyle === 'dashed'
              ? LineStyle.Dashed
              : lvl.lineStyle === 'dotted'
              ? LineStyle.Dotted
              : LineStyle.Solid,
          axisLabelVisible: true,
          title: lvl.label,
        });
        created.push(line);
      } catch {
        // ignore
      }
    }
    gexPriceLinesRef.current = created;

    return () => {
      for (const line of created) {
        try {
          series.removePriceLine(line);
        } catch {
          // ignore
        }
      }
      gexPriceLinesRef.current = [];
    };
  }, [
    gexOverlayLevels,
    symbolInfo.symbol,
    symbolInfo.lseHttpSymbol,
    timeframe,
    chartStyle,
    chartCanvasTheme,
    currencyFactor,
    effectiveDecimals,
  ]);

  // Render crisp Y-axis price scale tags for active pane's Visible Volume Profile (POC, VAH, VAL)
  useEffect(() => {
    const series = mainSeriesRef.current;
    if (!series) return;

    for (const line of vpPriceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // ignore if already removed
      }
    }
    vpPriceLinesRef.current = [];

    if (!vpVisible || !periodVolumeProfile || periodVolumeProfile.totalVolume <= 0) {
      return;
    }

    const created: IPriceLine[] = [];
    const showAxisTags = volumeProfileConfig.showLabels;
    const specs: Array<{ price: number; color: string; title: string; enabled: boolean }> = [
      {
        price: periodVolumeProfile.pocPrice,
        color: '#f23645',
        title: 'POC',
        enabled: volumeProfileConfig.showPoc,
      },
      {
        price: periodVolumeProfile.vahPrice,
        color: '#2962ff',
        title: 'VAH',
        enabled: volumeProfileConfig.showValueArea,
      },
      {
        price: periodVolumeProfile.valPrice,
        color: '#2962ff',
        title: 'VAL',
        enabled: volumeProfileConfig.showValueArea,
      },
    ];

    for (const spec of specs) {
      if (!spec.enabled || !Number.isFinite(spec.price) || spec.price <= 0) continue;
      try {
        const line = series.createPriceLine({
          price: Number(spec.price.toFixed(effectiveDecimals)),
          color: spec.color,
          lineVisible: false,
          axisLabelVisible: showAxisTags,
          axisLabelColor: spec.color,
          axisLabelTextColor: '#ffffff',
          title: spec.title,
        });
        created.push(line);
      } catch {
        // ignore
      }
    }
    vpPriceLinesRef.current = created;

    return () => {
      for (const line of created) {
        try {
          series.removePriceLine(line);
        } catch {
          // ignore
        }
      }
      vpPriceLinesRef.current = [];
    };
  }, [
    vpVisible,
    periodVolumeProfile,
    volumeProfileConfig.showPoc,
    volumeProfileConfig.showValueArea,
    volumeProfileConfig.showLabels,
    effectiveDecimals,
    chartStyle,
    chartCanvasTheme,
    timeframe,
    symbolInfo.symbol,
  ]);

  // Multi-chart Crosshair Synchronization
  useEffect(() => {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series) return;
    if (!syncedCrosshair) {
      if (!hoverData) {
        try {
          chart.clearCrosshairPosition();
        } catch {
          // ignore
        }
      }
      return;
    }
    if (syncedCrosshair.sourcePaneId === paneId) return;
    const bar = candleMapRef.current.get(syncedCrosshair.time);
    if (bar) {
      try {
        chart.setCrosshairPosition(bar.close, bar.time as Time, series);
      } catch {
        // ignore
      }
    }
  }, [syncedCrosshair, paneId, hoverData]);

  // Multi-chart Time Scroll Synchronization
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !syncedTimeRange || syncedTimeRange.sourcePaneId === paneId) return;
    try {
      isApplyingSyncRangeRef.current = true;
      chart.timeScale().setVisibleLogicalRange({
        from: syncedTimeRange.from,
        to: syncedTimeRange.to,
      });
    } catch {
      // ignore
    } finally {
      requestAnimationFrame(() => {
        isApplyingSyncRangeRef.current = false;
      });
    }
  }, [syncedTimeRange, paneId]);

  // Handle Zoom In button click from left toolbar
  useEffect(() => {
    if (zoomTrigger === 0 || !chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (range) {
      const span = range.to - range.from;
      const nextSpan = Math.max(20, span * 0.75);
      ts.setVisibleLogicalRange({
        from: range.to - nextSpan,
        to: range.to,
      });
    }
  }, [zoomTrigger]);

  // Clear draft points & cancel pending animation frames whenever activeTool or symbol changes
  useEffect(() => {
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    pendingMoveCoordsRef.current = null;
    draftPointsRef.current = [];
    freehandPointsRef.current = [];
    isFreehandDownRef.current = false;
    pressStartPxRef.current = null;
    lastFreehandPxRef.current = null;
    liveDragDrawingRef.current = null;
    dragStateRef.current = null;
    pendingSelectTapRef.current = null;
    setDraftStepCount(0);
    setDraggingDrawingId(null);
    primitiveRef.current?.clearLivePreview();
    if (containerRef.current) {
      containerRef.current.style.cursor = '';
    }
  }, [activeTool, symbolInfo.symbol]);

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== null) {
        cancelAnimationFrame(moveRafRef.current);
      }
    };
  }, []);

  const candleIntervalSec = useMemo(() => {
    if (processedCandles.length < 2) return 60;
    return Math.max(1, processedCandles[processedCandles.length - 1].time - processedCandles[processedCandles.length - 2].time);
  }, [processedCandles]);

  // Helper to convert (time, price) <-> pixel coordinates (including gap-interior & future bars)
  const toCoords = useCallback(
    (timeSec: number, price: number): { x: number | null; y: number | null } => {
      const chart = chartRef.current;
      const series = mainSeriesRef.current;
      if (!chart || !series) return { x: null, y: null };
      const x = timeToChartX(chart.timeScale(), processedCandles, candleIntervalSec, timeSec);
      const y = series.priceToCoordinate(price);
      return {
        x,
        y: y !== null ? Number(y) : null,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlayTick, processedCandles, candleIntervalSec]
  );

  const fromCoordsWithSnap = useCallback(
    (
      x: number,
      y: number,
      allowMagnet: boolean = true,
      invertMagnet: boolean = false
    ): { point: DrawingPoint; snapPixel: { x: number; y: number } | null } | null => {
      const chart = chartRef.current;
      const series = mainSeriesRef.current;
      if (!chart || !series || processedCandles.length === 0) return null;

      const rawPrice = series.coordinateToPrice(y);
      if (rawPrice === null) return null;

      // Weak-magnet 24px proximity threshold in price units (snaps to wicks H/L and bodies O/C)
      const offsetPrice = series.coordinateToPrice(y - 24);
      const maxPriceDelta =
        offsetPrice !== null ? Math.abs(Number(offsetPrice) - Number(rawPrice)) : undefined;

      const ts = chart.timeScale();
      const rawTime = ts.coordinateToTime(x);
      let timeSec: number;
      if (rawTime !== null && rawTime !== undefined && Number.isFinite(Number(rawTime)) && Number(rawTime) > 0) {
        timeSec = Number(rawTime);
      } else {
        const logical = ts.coordinateToLogical(x);
        const lastIdx = processedCandles.length - 1;
        if (logical !== null && Number.isFinite(Number(logical))) {
          const logicalNum = Number(logical);
          const rounded = Math.round(logicalNum);
          if (rounded >= 0 && rounded <= lastIdx) {
            timeSec = processedCandles[rounded].time;
          } else if (logicalNum > lastIdx) {
            // Exact future whitespace extrapolation to the RIGHT of the last candle
            timeSec = Math.round(processedCandles[lastIdx].time + (logicalNum - lastIdx) * candleIntervalSec);
          } else {
            timeSec = Math.round(processedCandles[0].time + logicalNum * candleIntervalSec);
          }
        } else {
          // Pixel fallback when cursor is beyond right/left axis edge
          const barSpacing = ts.options().barSpacing || 6;
          const lastX = ts.logicalToCoordinate(lastIdx as Logical);
          if (lastX !== null && Number.isFinite(Number(lastX))) {
            const deltaBars = (x - Number(lastX)) / Math.max(0.5, barSpacing);
            timeSec = Math.round(processedCandles[lastIdx].time + deltaBars * candleIntervalSec);
          } else {
            timeSec = processedCandles[lastIdx].time;
          }
        }
      }

      const useMagnet = allowMagnet && (invertMagnet ? !magnetActive : magnetActive);
      const snappedPrice = snapPriceToCandle(
        processedCandles,
        timeSec,
        Number(rawPrice),
        useMagnet,
        symbolInfo.tickSize,
        symbolInfo.decimals,
        maxPriceDelta
      );

      let snapPixel: { x: number; y: number } | null = null;
      if (useMagnet && maxPriceDelta !== undefined && Math.abs(snappedPrice - Number(rawPrice)) <= maxPriceDelta) {
        const sy = series.priceToCoordinate(snappedPrice);
        const sx = timeToChartX(ts, processedCandles, candleIntervalSec, timeSec);
        if (sy !== null && Math.abs(Number(sy) - y) <= 26) {
          snapPixel = { x: sx !== null ? sx : x, y: Number(sy) };
        }
      }

      return { point: { t: timeSec, p: snappedPrice }, snapPixel };
    },
    [processedCandles, magnetActive, candleIntervalSec, symbolInfo.tickSize, symbolInfo.decimals]
  );

  const fromCoords = useCallback(
    (
      x: number,
      y: number,
      allowMagnet: boolean = true,
      invertMagnet: boolean = false
    ): DrawingPoint | null => {
      return fromCoordsWithSnap(x, y, allowMagnet, invertMagnet)?.point ?? null;
    },
    [fromCoordsWithSnap]
  );

  // Quick-place a drawing automatically in the visible chart area (when double-clicking a favorite tool)
  const handleQuickPlaceTool = useCallback(
    (tool: DrawingToolId) => {
      if (tool === 'cursor' || processedCandles.length < 20 || drawingsLocked) return;
      const n = processedCandles.length;
      const anchorPrice =
        symbolInfo.price > 0
          ? symbolInfo.price
          : processedCandles[n - 1]?.close ?? 0;
      if (anchorPrice <= 0) return;

      const bar1 = processedCandles[Math.max(0, n - 48)];
      const bar2 = processedCandles[Math.max(0, n - 12)];
      const bar3 = processedCandles[Math.max(0, n - 6)];
      const spread = anchorPrice * 0.0012;
      const pHigh = Number((anchorPrice + spread).toFixed(symbolInfo.decimals));
      const pLow = Number((anchorPrice - spread).toFixed(symbolInfo.decimals));

      const mode = getToolPointMode(tool);
      let pts: DrawingPoint[] = [
        { t: bar1.time, p: pHigh },
        { t: bar2.time, p: pLow },
      ];
      if (mode === 1) {
        pts = [{ t: bar1.time, p: Number(anchorPrice.toFixed(symbolInfo.decimals)) }];
      } else if (mode === 3) {
        pts = [
          { t: bar1.time, p: pLow },
          { t: bar2.time, p: pHigh },
          { t: bar3.time, p: Number((anchorPrice - spread * 0.4).toFixed(symbolInfo.decimals)) },
        ];
      } else if (mode === 'multi') {
        pts = [
          { t: processedCandles[Math.max(0, n - 55)].time, p: pLow },
          { t: processedCandles[Math.max(0, n - 40)].time, p: pHigh },
          { t: processedCandles[Math.max(0, n - 28)].time, p: Number((anchorPrice - spread * 0.3).toFixed(symbolInfo.decimals)) },
          { t: bar2.time, p: Number((anchorPrice + spread * 1.4).toFixed(symbolInfo.decimals)) },
        ];
      }

      const newDrawing = createDrawingFromPoints(
        tool,
        symbolInfo.symbol,
        pts,
        processedCandles,
        symbolInfo.tickSize,
        symbolInfo.decimals
      );
      onAddDrawing(newDrawing);
      onSelectDrawing(newDrawing.id);
      if (!stayInDrawingMode) {
        onSelectTool('cursor');
      }
    },
    [processedCandles, symbolInfo, drawingsLocked, onAddDrawing, onSelectDrawing, stayInDrawingMode, onSelectTool]
  );

  const finalizeDraftDrawing = useCallback(
    (tool: DrawingToolId, pts: DrawingPoint[]) => {
      if (pts.length === 0) return;
      const newDrawing = createDrawingFromPoints(
        tool,
        symbolInfo.symbol,
        pts,
        processedCandles,
        symbolInfo.tickSize,
        symbolInfo.decimals
      );
      onAddDrawing(newDrawing);
      onSelectDrawing(newDrawing.id);

      draftPointsRef.current = [];
      freehandPointsRef.current = [];
      isFreehandDownRef.current = false;
      pressStartPxRef.current = null;
      lastFreehandPxRef.current = null;
      setDraftStepCount(0);
      primitiveRef.current?.clearLivePreview();

      if (tool === 'text-note' || tool === 'callout' || tool === 'price-label') {
        setEditingTextDrawingId(newDrawing.id);
        setEditingTextValue(newDrawing.text || '');
      }
      if (!stayInDrawingMode) {
        onSelectTool('cursor');
      }
    },
    [symbolInfo, processedCandles, onAddDrawing, onSelectDrawing, stayInDrawingMode, onSelectTool]
  );

  // Enter key completes multi-point polyline / Elliott wave; Escape cancels in-progress draft or text editor
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (editingTextDrawingId) {
        if (ev.key === 'Escape') {
          setEditingTextDrawingId(null);
        }
        return;
      }
      if (ev.key === 'Enter' && draftPointsRef.current.length >= 2 && getToolPointMode(activeTool) === 'multi') {
        ev.preventDefault();
        finalizeDraftDrawing(activeTool, draftPointsRef.current);
      } else if (ev.key === 'Escape' && (draftPointsRef.current.length > 0 || isFreehandDownRef.current)) {
        draftPointsRef.current = [];
        freehandPointsRef.current = [];
        isFreehandDownRef.current = false;
        setDraftStepCount(0);
        primitiveRef.current?.clearLivePreview();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTool, editingTextDrawingId, finalizeDraftDrawing]);

  const activeSymbolDrawings = useMemo(
    () =>
      drawings.filter(
        (d) =>
          d.symbol === symbolInfo.symbol &&
          d.id !== draggingDrawingId &&
          (!d.visibleTimeframes ||
            d.visibleTimeframes.length === 0 ||
            d.visibleTimeframes.includes(timeframe))
      ),
    [drawings, symbolInfo.symbol, draggingDrawingId, timeframe]
  );

  const selectedDrawing = useMemo(
    () => activeSymbolDrawings.find((d) => d.id === selectedDrawingId) ?? null,
    [activeSymbolDrawings, selectedDrawingId]
  );

  const settingsModalDrawing = useMemo(
    () =>
      drawingSettingsState
        ? drawings.find(
            (d) => d.symbol === symbolInfo.symbol && d.id === drawingSettingsState.drawingId
          ) ?? null
        : null,
    [drawingSettingsState, drawings, symbolInfo.symbol]
  );

  const handleSaveDrawingTemplate = useCallback((name: string, source: ChartDrawing) => {
    const toolGroup: DrawingTemplate['toolGroup'] = isLineToolId(source.tool)
      ? 'line'
      : source.tool === 'rectangle'
      ? 'rectangle'
      : 'other';
    const newTpl: DrawingTemplate = {
      id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      toolGroup,
      style: {
        color: source.color,
        fillColor: source.fillColor,
        fillOpacity: source.fillOpacity,
        showBorder: source.showBorder,
        borderOpacity: source.borderOpacity,
        showFill: source.showFill,
        lineWidth: source.lineWidth,
        lineStyle: source.lineStyle,
        extendLeft: source.extendLeft,
        extendRight: source.extendRight,
        showMidline: source.showMidline,
        midlineColor: source.midlineColor,
        midlineOpacity: source.midlineOpacity,
        midlineStyle: source.midlineStyle,
        midlineWidth: source.midlineWidth,
        angleSnap: source.angleSnap,
        leftEnd: source.leftEnd,
        rightEnd: source.rightEnd,
        textColor: source.textColor,
        fontSize: source.fontSize,
        textBold: source.textBold,
        textItalic: source.textItalic,
        textAlignH: source.textAlignH,
        textAlignV: source.textAlignV,
        textOrientation: source.textOrientation,
        textWrap: source.textWrap,
        showLabels: source.showLabels,
        showMiddlePoint: source.showMiddlePoint,
        showPriceRange: source.showPriceRange,
        showPercentChange: source.showPercentChange,
        showBarsRange: source.showBarsRange,
        showAngle: source.showAngle,
        alwaysShowStats: source.alwaysShowStats,
      },
    };
    if (onSaveDrawingTemplateProp) {
      onSaveDrawingTemplateProp(newTpl);
    } else {
      setLocalDrawingTemplates((prev) => [newTpl, ...prev].slice(0, 24));
    }
  }, [onSaveDrawingTemplateProp]);

  const handleApplyDrawingTemplate = useCallback(
    (tpl: DrawingTemplate, target: ChartDrawing) => {
      onUpdateDrawing({
        ...target,
        ...tpl.style,
      });
    },
    [onUpdateDrawing]
  );

  const handleToggleAngleSnap = useCallback(
    (target: ChartDrawing, enabled: boolean) => {
      let nextDrawing: ChartDrawing = { ...target, angleSnap: enabled };
      if (enabled && target.points.length >= 2) {
        const p0 = target.points[0];
        const p1 = target.points[1];
        const p0px = toCoords(p0.t, p0.p);
        const p1px = toCoords(p1.t, p1.p);
        if (p0px.x !== null && p0px.y !== null && p1px.x !== null && p1px.y !== null) {
          const snappedPx = applyShiftConstraint(
            target.tool,
            { x: p0px.x, y: p0px.y },
            { x: p1px.x, y: p1px.y }
          );
          const snappedPt = fromCoords(snappedPx.x, snappedPx.y, false);
          if (snappedPt) {
            const nextPts = target.points.map((pt, idx) => (idx === 1 ? snappedPt : pt));
            nextDrawing = {
              ...nextDrawing,
              points: nextPts,
              t2: snappedPt.t,
              p2: snappedPt.p,
            };
          }
        }
      }
      onUpdateDrawing(nextDrawing);
    },
    [toCoords, fromCoords, onUpdateDrawing]
  );

  const getCachedContainerRect = useCallback(() => {
    if (!containerRectRef.current && containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }
    return containerRectRef.current;
  }, []);

  const setChartPanZoomEnabled = useCallback((enabled: boolean) => {
    try {
      chartRef.current?.applyOptions({
        handleScroll: enabled,
        handleScale: enabled,
      });
    } catch {
      // ignore if chart unmounted
    }
    if (chartContainerRef.current) {
      chartContainerRef.current.style.pointerEvents = enabled ? '' : 'none';
    }
  }, []);

  // Intercept native mousedown / touchstart / touchmove on chart canvas when dragging a drawing or hitting a handle
  // so lightweight-charts never pans/scrolls together with the drawing handle
  useEffect(() => {
    const chartEl = chartContainerRef.current;
    if (!chartEl) return;

    const blockNativeChartGesture = (ev: Event) => {
      if (dragStateRef.current) {
        ev.stopPropagation();
        ev.preventDefault();
        setChartPanZoomEnabled(false);
      }
    };

    const handleGlobalEnd = () => {
      if (dragStateRef.current) {
        setChartPanZoomEnabled(true);
      }
    };

    chartEl.addEventListener('pointerdown', blockNativeChartGesture, { capture: true });
    chartEl.addEventListener('mousedown', blockNativeChartGesture, { capture: true });
    chartEl.addEventListener('touchstart', blockNativeChartGesture, { capture: true, passive: false });
    chartEl.addEventListener('touchmove', blockNativeChartGesture, { capture: true, passive: false });
    window.addEventListener('pointerup', handleGlobalEnd);
    window.addEventListener('pointercancel', handleGlobalEnd);
    window.addEventListener('blur', handleGlobalEnd);

    return () => {
      chartEl.removeEventListener('pointerdown', blockNativeChartGesture, { capture: true });
      chartEl.removeEventListener('mousedown', blockNativeChartGesture, { capture: true });
      chartEl.removeEventListener('touchstart', blockNativeChartGesture, { capture: true });
      chartEl.removeEventListener('touchmove', blockNativeChartGesture, { capture: true });
      window.removeEventListener('pointerup', handleGlobalEnd);
      window.removeEventListener('pointercancel', handleGlobalEnd);
      window.removeEventListener('blur', handleGlobalEnd);
    };
  }, [setChartPanZoomEnabled]);

  // Pointer capture handler on chart wrapper for cursor selection, handle/body drag, & Shift+Drag measure
  const handleContainerPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'cursor') return;
    if (!e.isPrimary) {
      pendingSelectTapRef.current = null;
      if (dragStateRef.current) {
        dragStateRef.current = null;
        liveDragDrawingRef.current = null;
        primitiveRef.current?.clearLivePreview();
        setDraggingDrawingId(null);
        setChartPanZoomEnabled(true);
      }
      return;
    }
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, input, select, [role="toolbar"], [data-drawing-ui="true"]')) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    containerRectRef.current = rect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Ignore clicks on right price axis or bottom time axis so native axis drag works
    if (x > rect.width - 70 || y > rect.height - 28) return;

    // Shift + Click/Drag => Quick Measure tool
    if (e.shiftKey) {
      const pt = fromCoords(x, y);
      if (!pt) return;
      setChartPanZoomEnabled(false);
      e.stopPropagation();
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // Ignore in synthetic environments
      }
      const measureObj = createDrawingFromPoints(
        'measure',
        symbolInfo.symbol,
        [pt, pt],
        processedCandles,
        symbolInfo.tickSize,
        symbolInfo.decimals
      );
      dragStateRef.current = {
        mode: 'shift-measure',
        drawingId: 'shift-measure',
        startChartPt: pt,
        origDrawing: measureObj,
      };
      liveDragDrawingRef.current = measureObj;
      primitiveRef.current?.setLivePreview({ drawing: { ...measureObj, id: 'draft-preview' } });
      return;
    }

    if (drawingsHidden) {
      pendingSelectTapRef.current = null;
      onSelectDrawing(null);
      return;
    }

    const hitTolerance = e.pointerType === 'touch' ? 20 : 12;
    const hit = hitTestDrawings(
      activeSymbolDrawings,
      x,
      y,
      toCoords,
      rect.width,
      rect.height,
      hitTolerance
    );

    if (!hit) {
      pendingSelectTapRef.current = null;
      if (selectedDrawingIdRef.current !== null) onSelectDrawing(null);
      setChartPanZoomEnabled(true);
      return; // Allow lightweight-charts to pan/zoom natively
    }

    // Drawings ONLY move/resize if already selected. Dragging over an unselected
    // drawing must pan the chart natively; a clean tap/click without dragging selects it.
    if (hit.drawingId !== selectedDrawingIdRef.current) {
      pendingSelectTapRef.current = {
        drawingId: hit.drawingId,
        startX: x,
        startY: y,
        pointerId: e.pointerId,
      };
      setChartPanZoomEnabled(true);
      return;
    }

    pendingSelectTapRef.current = null;
    e.stopPropagation();

    const hitDrawing = activeSymbolDrawings.find((d) => d.id === hit.drawingId);
    if (!hitDrawing || hitDrawing.locked || drawingsLocked) return;

    const pt = fromCoords(x, y, hit.handleIndex !== null);
    if (!pt) return;

    setChartPanZoomEnabled(false);
    e.preventDefault();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore in synthetic environments
    }

    dragStateRef.current = {
      mode: hit.handleIndex !== null ? 'handle' : 'body',
      drawingId: hitDrawing.id,
      handleIndex: hit.handleIndex ?? undefined,
      startChartPt: pt,
      origDrawing: hitDrawing,
    };
    liveDragDrawingRef.current = hitDrawing;
    setDraggingDrawingId(hitDrawing.id);
    primitiveRef.current?.setLivePreview({ drawing: hitDrawing });
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  };

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = getCachedContainerRect();
    if (!rect) return;
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    if (
      pendingSelectTapRef.current &&
      pendingSelectTapRef.current.pointerId === e.pointerId &&
      Math.hypot(relX - pendingSelectTapRef.current.startX, relY - pendingSelectTapRef.current.startY) > 6
    ) {
      // User is dragging to pan/scroll chart — cancel tap-to-select
      pendingSelectTapRef.current = null;
    }
    // Keep right price-scale HTML badges aligned when dragging the price scale vertically or panning
    if (e.buttons > 0 && relX > rect.width - 70) {
      refreshOverlay();
    }
    pendingMoveCoordsRef.current = {
      x: relX,
      y: relY,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    };

    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const coords = pendingMoveCoordsRef.current;
      const curRect = containerRectRef.current;
      if (!coords || !curRect) return;
      const { x, y, shiftKey, ctrlKey } = coords;

      if (dragStateRef.current) {
        const ds = dragStateRef.current;
        if (ds.mode === 'shift-measure') {
          const snapped = fromCoordsWithSnap(x, y, true, ctrlKey);
          if (snapped) {
            const nextPreview: ChartDrawing = {
              id: 'draft-preview',
              symbol: symbolInfo.symbol,
              tool: 'measure',
              points: [ds.startChartPt, snapped.point],
              t1: ds.startChartPt.t,
              p1: ds.startChartPt.p,
              t2: snapped.point.t,
              p2: snapped.point.p,
              color: '#2962ff',
            };
            primitiveRef.current?.setLivePreview({
              drawing: nextPreview,
              snapPixel: snapped.snapPixel,
            });
          }
          return;
        }
        if (ds.mode === 'handle' && ds.handleIndex !== undefined) {
          let tx = x;
          let ty = y;
          const enforceAngleOrAspect = Boolean(shiftKey || ds.origDrawing.angleSnap);
          if (enforceAngleOrAspect && ds.origDrawing.points.length >= 2) {
            let anchorPt: DrawingPoint | null = null;
            if (ds.origDrawing.tool === 'rectangle') {
              const r0 = ds.origDrawing.points[0];
              const r1 = ds.origDrawing.points[1];
              if (ds.handleIndex === 0) anchorPt = r1;
              else if (ds.handleIndex === 1) anchorPt = r0;
              else if (ds.handleIndex === 2) anchorPt = { t: r0.t, p: r1.p };
              else if (ds.handleIndex === 3) anchorPt = { t: r1.t, p: r0.p };
              // Edge midpoints 4..7 resize on one axis only
            } else {
              const anchorIdx = ds.handleIndex === 0 ? 1 : 0;
              anchorPt = ds.origDrawing.points[anchorIdx] ?? null;
            }
            if (anchorPt) {
              const anchorPx = toCoords(anchorPt.t, anchorPt.p);
              if (anchorPx.x !== null && anchorPx.y !== null) {
                const constrained = applyShiftConstraint(
                  ds.origDrawing.tool,
                  { x: anchorPx.x, y: anchorPx.y },
                  { x, y }
                );
                tx = constrained.x;
                ty = constrained.y;
              }
            }
          }
          const snapped = fromCoordsWithSnap(tx, ty, true, ctrlKey);
          if (snapped) {
            const next = moveDrawingHandle(ds.origDrawing, ds.handleIndex, snapped.point);
            liveDragDrawingRef.current = next;
            primitiveRef.current?.setLivePreview({
              drawing: next,
              snapPixel: snapped.snapPixel,
            });
          }
          return;
        }
        if (ds.mode === 'body') {
          const pt = fromCoords(x, y, false);
          if (pt) {
            const dt = pt.t - ds.startChartPt.t;
            const dp = pt.p - ds.startChartPt.p;
            const next = translateDrawing(ds.origDrawing, dt, dp);
            liveDragDrawingRef.current = next;
            primitiveRef.current?.setLivePreview({ drawing: next });
          }
          return;
        }
      }

      // Hover cursor & handle highlight without triggering React re-renders
      if (
        activeTool === 'cursor' &&
        !drawingsHidden &&
        activeSymbolDrawings.length > 0 &&
        x < curRect.width - 70 &&
        y < curRect.height - 28
      ) {
        const hit = hitTestDrawings(
          activeSymbolDrawings,
          x,
          y,
          toCoords,
          curRect.width,
          curRect.height
        );
        primitiveRef.current?.setHoveredDrawingId(hit?.drawingId ?? null);
        if (containerRef.current) {
          const isSelectedHover = Boolean(hit && hit.drawingId === selectedDrawingIdRef.current);
          containerRef.current.style.cursor =
            hit?.handleIndex !== null && hit?.handleIndex !== undefined && isSelectedHover
              ? 'pointer'
              : isSelectedHover
              ? 'grab'
              : hit
              ? 'pointer'
              : '';
        }
      } else {
        primitiveRef.current?.setHoveredDrawingId(null);
        if (containerRef.current && containerRef.current.style.cursor) {
          containerRef.current.style.cursor = '';
        }
      }
    });
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setChartPanZoomEnabled(true);
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const pendingSelect = pendingSelectTapRef.current;
    pendingSelectTapRef.current = null;
    if (
      e.type === 'pointerup' &&
      pendingSelect &&
      pendingSelect.pointerId === e.pointerId &&
      !dragStateRef.current
    ) {
      const rect = getCachedContainerRect();
      if (rect) {
        const upX = e.clientX - rect.left;
        const upY = e.clientY - rect.top;
        if (Math.hypot(upX - pendingSelect.startX, upY - pendingSelect.startY) <= 6) {
          onSelectDrawing(pendingSelect.drawingId);
        }
      }
    }

    if (dragStateRef.current) {
      const ds = dragStateRef.current;
      dragStateRef.current = null;
      const finalDrag = liveDragDrawingRef.current;
      liveDragDrawingRef.current = null;
      primitiveRef.current?.clearLivePreview();
      setDraggingDrawingId(null);
      if (containerRef.current) {
        containerRef.current.style.cursor = '';
      }

      if (ds.mode === 'shift-measure') {
        return;
      }
      if (finalDrag) {
        const changed =
          JSON.stringify(finalDrag.points) !== JSON.stringify(ds.origDrawing.points);
        if (changed) {
          onUpdateDrawing(finalDrag);
        }
      }
    }
  };

  const handleContainerDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'cursor' || drawingsHidden) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, input, textarea, select, [role="toolbar"], [data-drawing-ui="true"]')) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = hitTestDrawings(activeSymbolDrawings, x, y, toCoords, rect.width, rect.height);
    if (!hit) return;
    const d = activeSymbolDrawings.find((item) => item.id === hit.drawingId);
    if (!d) return;
    onSelectDrawing(d.id);
    setEditingTextDrawingId(d.id);
    setEditingTextValue(d.text || '');
  };

  const handleContainerContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'cursor' || drawingsHidden) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, input, textarea, select, [role="toolbar"], [data-drawing-ui="true"]')) {
      return;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x > rect.width - 70 || y > rect.height - 28) return;
    const hit = hitTestDrawings(activeSymbolDrawings, x, y, toCoords, rect.width, rect.height, 12);
    if (!hit) {
      setDrawingContextMenu(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onSelectDrawing(hit.drawingId);
    setDrawingContextMenu({
      x: Math.min(rect.width - 190, Math.max(8, x)),
      y: Math.min(rect.height - 270, Math.max(8, y)),
      drawingId: hit.drawingId,
    });
  };

  // Active Drawing Mode layer handlers (60/120fps via refs + rAF + ChartOverlaysPrimitive)
  const handleDrawingLayerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'cursor' || drawingsLocked) return;
    const targetEl = e.target as HTMLElement;
    if (targetEl.closest('button, input, textarea, select, [role="toolbar"], [data-drawing-ui="true"]')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    containerRectRef.current = rect;
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    const mode = getToolPointMode(activeTool);

    if (e.shiftKey && draftPointsRef.current.length > 0 && mode !== 'freehand' && mode !== 1) {
      const anchorPt = draftPointsRef.current[draftPointsRef.current.length - 1];
      const anchorPx = toCoords(anchorPt.t, anchorPt.p);
      if (anchorPx.x !== null && anchorPx.y !== null) {
        const constrained = applyShiftConstraint(activeTool, { x: anchorPx.x, y: anchorPx.y }, { x, y });
        x = constrained.x;
        y = constrained.y;
      }
    }

    const snapped = fromCoordsWithSnap(x, y, mode !== 'freehand', e.ctrlKey || e.metaKey);
    if (!snapped) return;
    const pt = snapped.point;

    if (mode === 1) {
      finalizeDraftDrawing(activeTool, [pt]);
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore in synthetic environments
    }

    if (mode === 'freehand') {
      isFreehandDownRef.current = true;
      freehandPointsRef.current = [pt];
      lastFreehandPxRef.current = { x, y };
      setDraftStepCount(1);
      primitiveRef.current?.setLivePreview({
        drawing: {
          id: 'draft-preview',
          symbol: symbolInfo.symbol,
          tool: activeTool,
          points: [pt],
          t1: pt.t,
          p1: pt.p,
          t2: pt.t,
          p2: pt.p,
          color: activeTool === 'highlighter' ? '#ffeb3b' : '#2962ff',
        },
      });
      return;
    }

    if (mode === 2) {
      if (draftPointsRef.current.length === 0) {
        draftPointsRef.current = [pt];
        pressStartPxRef.current = { x, y };
        setDraftStepCount(1);
        primitiveRef.current?.setLivePreview({
          drawing: {
            id: 'draft-preview',
            symbol: symbolInfo.symbol,
            tool: activeTool,
            points: [pt, pt],
            t1: pt.t,
            p1: pt.p,
            t2: pt.t,
            p2: pt.p,
            color: '#2962ff',
          },
          snapPixel: snapped.snapPixel,
        });
      } else {
        finalizeDraftDrawing(activeTool, [draftPointsRef.current[0], pt]);
      }
      return;
    }

    if (mode === 3) {
      const next = [...draftPointsRef.current, pt];
      if (next.length >= 3) {
        finalizeDraftDrawing(activeTool, next.slice(0, 3));
      } else {
        draftPointsRef.current = next;
        pressStartPxRef.current = next.length === 1 ? { x, y } : null;
        setDraftStepCount(next.length);
      }
      return;
    }

    if (mode === 'multi') {
      const next = [...draftPointsRef.current, pt];
      if (activeTool === 'elliott-wave' && next.length >= 6) {
        finalizeDraftDrawing(activeTool, next.slice(0, 6));
      } else {
        draftPointsRef.current = next;
        setDraftStepCount(next.length);
      }
    }
  };

  const handleDrawingLayerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'cursor' || drawingsLocked) return;
    const rect = getCachedContainerRect() ?? e.currentTarget.getBoundingClientRect();
    containerRectRef.current = rect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pendingMoveCoordsRef.current = {
      x,
      y,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey || e.metaKey,
    };

    const mode = getToolPointMode(activeTool);

    // Collect freehand stroke vertices at 3px granularity cleanly before rAF paint
    if (mode === 'freehand' && isFreehandDownRef.current) {
      const lastPx = lastFreehandPxRef.current;
      if (!lastPx || Math.hypot(x - lastPx.x, y - lastPx.y) >= 3) {
        const pt = fromCoords(x, y, false);
        if (pt) {
          lastFreehandPxRef.current = { x, y };
          freehandPointsRef.current.push(pt);
        }
      }
    }

    if (moveRafRef.current !== null) return;
    moveRafRef.current = requestAnimationFrame(() => {
      moveRafRef.current = null;
      const coords = pendingMoveCoordsRef.current;
      if (!coords) return;

      if (mode === 'freehand') {
        if (!isFreehandDownRef.current || freehandPointsRef.current.length < 2) return;
        const pts = freehandPointsRef.current;
        primitiveRef.current?.setLivePreview({
          drawing: {
            id: 'draft-preview',
            symbol: symbolInfo.symbol,
            tool: activeTool,
            points: [...pts],
            t1: pts[0].t,
            p1: pts[0].p,
            t2: pts[pts.length - 1].t,
            p2: pts[pts.length - 1].p,
            color: activeTool === 'highlighter' ? '#ffeb3b' : '#2962ff',
          },
        });
        return;
      }

      let tx = coords.x;
      let ty = coords.y;
      if (coords.shiftKey && draftPointsRef.current.length > 0 && mode !== 1) {
        const anchorPt = draftPointsRef.current[draftPointsRef.current.length - 1];
        const anchorPx = toCoords(anchorPt.t, anchorPt.p);
        if (anchorPx.x !== null && anchorPx.y !== null) {
          const constrained = applyShiftConstraint(
            activeTool,
            { x: anchorPx.x, y: anchorPx.y },
            { x: tx, y: ty }
          );
          tx = constrained.x;
          ty = constrained.y;
        }
      }

      const snapped = fromCoordsWithSnap(tx, ty, true, coords.ctrlKey);
      if (!snapped) return;

      if (draftPointsRef.current.length > 0) {
        const pts = [...draftPointsRef.current, snapped.point];
        primitiveRef.current?.setLivePreview({
          drawing: {
            id: 'draft-preview',
            symbol: symbolInfo.symbol,
            tool: activeTool,
            points: pts,
            t1: pts[0].t,
            p1: pts[0].p,
            t2: pts[1].t,
            p2: pts[1].p,
            color: '#2962ff',
          },
          snapPixel: snapped.snapPixel,
        });
      } else if (
        activeTool === 'horizontal-line' ||
        activeTool === 'horizontal-ray' ||
        activeTool === 'vertical-line' ||
        activeTool === 'cross-line'
      ) {
        // TradingView-style ghost line guide before single-click placement
        primitiveRef.current?.setLivePreview({
          drawing: {
            id: 'draft-preview',
            symbol: symbolInfo.symbol,
            tool: activeTool,
            points: [snapped.point],
            t1: snapped.point.t,
            p1: snapped.point.p,
            t2: snapped.point.t,
            p2: snapped.point.p,
            color: '#2962ff',
          },
          isGhost: true,
          snapPixel: snapped.snapPixel,
        });
      } else if (snapped.snapPixel) {
        primitiveRef.current?.setLivePreview({
          drawing: null,
          snapPixel: snapped.snapPixel,
        });
      } else {
        primitiveRef.current?.clearLivePreview();
      }
    });
  };

  const handleDrawingLayerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'cursor' || drawingsLocked) return;
    if (moveRafRef.current !== null) {
      cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    const rect = getCachedContainerRect() ?? e.currentTarget.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    const mode = getToolPointMode(activeTool);

    if (mode === 'freehand' && isFreehandDownRef.current) {
      isFreehandDownRef.current = false;
      const curPts = freehandPointsRef.current;
      const pts =
        curPts.length >= 2
          ? [...curPts]
          : [
              ...curPts,
              {
                t: (curPts[0]?.t ?? Math.floor(Date.now() / 1000)) + candleIntervalSec,
                p: curPts[0]?.p ?? symbolInfo.price,
              },
            ];
      finalizeDraftDrawing(activeTool, pts);
      return;
    }

    if ((mode === 2 || mode === 3) && draftPointsRef.current.length === 1 && pressStartPxRef.current) {
      const dragDist = Math.hypot(x - pressStartPxRef.current.x, y - pressStartPxRef.current.y);
      pressStartPxRef.current = null;
      if (dragDist >= 6) {
        if (e.shiftKey) {
          const anchorPt = draftPointsRef.current[0];
          const anchorPx = toCoords(anchorPt.t, anchorPt.p);
          if (anchorPx.x !== null && anchorPx.y !== null) {
            const constrained = applyShiftConstraint(activeTool, { x: anchorPx.x, y: anchorPx.y }, { x, y });
            x = constrained.x;
            y = constrained.y;
          }
        }
        const pt = fromCoords(x, y, true, e.ctrlKey || e.metaKey);
        if (pt) {
          if (mode === 2) {
            finalizeDraftDrawing(activeTool, [draftPointsRef.current[0], pt]);
          } else {
            // For 3-point tools (Parallel Channel, Triangle, Pitchfork, Fib Extension):
            // drag sets P1->P2 baseline, then next click sets P3!
            draftPointsRef.current = [draftPointsRef.current[0], pt];
            setDraftStepCount(2);
          }
        }
      }
    }
  };

  const handleDrawingLayerDoubleClick = () => {
    if (getToolPointMode(activeTool) === 'multi' && draftPointsRef.current.length >= 2) {
      finalizeDraftDrawing(activeTool, draftPointsRef.current);
    }
  };

  // Current OHLC readout for the top-left legend
  const lastCandle = processedCandles[processedCandles.length - 1];
  const displayBar: Omit<HoverBarData, 'x' | 'y'> = hoverData || {
    time: lastCandle?.time ?? 0,
    open: lastCandle?.open ?? symbolInfo.dayOpen,
    high: lastCandle?.high ?? symbolInfo.dayHigh,
    low: lastCandle?.low ?? symbolInfo.dayLow,
    close: lastCandle?.close ?? symbolInfo.price,
    volume: lastCandle?.volume ?? 0,
    change: lastCandle ? lastCandle.close - lastCandle.open : 0,
    changePercent:
      lastCandle && lastCandle.open !== 0
        ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100
        : 0,
    vwap: undefined,
  };

  const isLight = chartCanvasTheme === 'light';
  const rawCurrentPrice = lastCandle?.close ?? symbolInfo.price * currencyFactor;
  const displayCurrentPrice = rawCurrentPrice > 0 ? rawCurrentPrice : 0;
  const currentPriceY =
    displayCurrentPrice > 0 && mainSeriesRef.current
      ? mainSeriesRef.current.priceToCoordinate(displayCurrentPrice)
      : null;

  const committedDrawings = useMemo(
    () => (drawingsHidden ? [] : activeSymbolDrawings),
    [drawingsHidden, activeSymbolDrawings]
  );

  // Sync chart overlays primitive with React state (zones, IV walls, GEX strike histogram, drawings, theme)
  useEffect(() => {
    const gexExpectedMove =
      gexIndicatorVisible &&
      gexOverlayConfig?.showExpectedMove &&
      gexData?.metrics.expectedMoveUpper &&
      gexData?.metrics.expectedMoveLower
        ? {
            upper: gexData.metrics.expectedMoveUpper * gexSpotScaleRatio * currencyFactor,
            lower: gexData.metrics.expectedMoveLower * gexSpotScaleRatio * currencyFactor,
          }
        : null;

    primitiveRef.current?.setState({
      candles: processedCandles,
      candleIntervalSec,
      symbolInfo,
      isLight: chartCanvasTheme === 'light',
      ssmtVisible,
      ivWallsVisible,
      supplyDemandZones,
      ivWalls,
      drawings: committedDrawings,
      selectedDrawingId,
      hoveredDrawingId: null,
      gexStrikes: gexIndicatorVisible ? gexData?.strikes : undefined,
      gexShowHistogram: Boolean(gexIndicatorVisible && gexOverlayConfig?.showStrikeHistogram),
      gexSpotScaleRatio: gexSpotScaleRatio * currencyFactor,
      gexExpectedMove,
      absorptionVisible,
      orderflowPoints,
      volumeProfileVisible: vpVisible,
      volumeProfileConfig,
      volumeProfileData: periodVolumeProfile,
    });
  }, [
    processedCandles,
    candleIntervalSec,
    symbolInfo,
    chartCanvasTheme,
    ssmtVisible,
    ivWallsVisible,
    supplyDemandZones,
    ivWalls,
    committedDrawings,
    selectedDrawingId,
    gexIndicatorVisible,
    gexData,
    gexOverlayConfig?.showExpectedMove,
    gexOverlayConfig?.showStrikeHistogram,
    gexSpotScaleRatio,
    currencyFactor,
    absorptionVisible,
    orderflowPoints,
    vpVisible,
    volumeProfileConfig,
    periodVolumeProfile,
  ]);

  const wrapperCursorClass = activeTool !== 'cursor' ? 'cursor-crosshair' : '';

  return (
    <div
      ref={containerRef}
      style={{
        touchAction: draggingDrawingId || activeTool !== 'cursor' ? 'none' : undefined,
      }}
      onMouseDown={() => onFocusPane?.()}
      onPointerDownCapture={handleContainerPointerDownCapture}
      onPointerMove={handleContainerPointerMove}
      onPointerUp={handleContainerPointerUp}
      onPointerCancel={handleContainerPointerUp}
      onDoubleClick={handleContainerDoubleClick}
      onContextMenu={handleContainerContextMenu}
      className={`relative flex-1 w-full h-full min-w-0 min-h-0 overflow-hidden select-none ${wrapperCursorClass} ${
        appTheme && appTheme.wallpaperMode !== 'none' && appTheme.chartBgOpacity < 0.995
          ? 'bg-transparent'
          : 'bg-[var(--tv-chart-bg)]'
      } ${
        isMultiPane
          ? isActivePane
            ? 'ring-1 ring-inset ring-[var(--tv-accent)]'
            : 'ring-1 ring-inset ring-[var(--tv-border)]'
          : ''
      }`}
    >
      {/* Optional Symbol Watermark Behind Chart */}
      {chartSettings?.watermarkMode === 'Visible' && (
        <div
          aria-hidden="true"
          style={{ color: chartSettings.watermarkColor }}
          className="absolute inset-0 z-[1] flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden"
        >
          <div className="text-[48px] sm:text-[64px] font-bold tracking-tight leading-none opacity-80">
            {symbolInfo.symbol}, {timeframe}
          </div>
          <div className="text-[14px] font-medium tracking-wide mt-1 opacity-75">
            {symbolInfo.name} · {symbolInfo.exchange}
          </div>
        </div>
      )}

      {/* Lightweight Charts Canvas Mount Container */}
      <div
        ref={chartContainerRef}
        data-testid={`tradingview-chart-canvas-${paneId}`}
        className="w-full h-full"
      />

      {/* Real LSE Data Loading / Empty / Error State Overlay (zero synthetic candles) */}
      {processedCandles.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div
            className="px-4 py-3 rounded-xl border tv-glass-popover text-center text-[var(--tv-text)] pointer-events-auto"
          >
            {loadingCandles ? (
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="w-3 h-3 rounded-full border-2 border-[#2962ff] border-t-transparent animate-spin" />
                <span>
                  Loading live LSE Data 3.0 bars for <strong>{symbolInfo.symbol}</strong> ({timeframe})...
                </span>
              </div>
            ) : candlesError ? (
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-[#f23645]">
                  Unable to load LSE candles for {symbolInfo.symbol}
                </div>
                <div className="text-[11px] text-[#787b86] max-w-xs">{candlesError}</div>
                {onRetryCandles && (
                  <button
                    type="button"
                    onClick={onRetryCandles}
                    className="px-3 py-1 rounded bg-[#2962ff] hover:bg-[#1e53e5] text-white text-[11px] font-medium"
                  >
                    Retry
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs text-[#787b86]">
                No historical bars available for {symbolInfo.symbol} ({timeframe}).
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Pointer Capture Layer when a Drawing Tool is Active */}
      {activeTool !== 'cursor' && !drawingsLocked && (
        <div
          onPointerDown={handleDrawingLayerPointerDown}
          onPointerMove={handleDrawingLayerPointerMove}
          onPointerUp={handleDrawingLayerPointerUp}
          onDoubleClick={handleDrawingLayerDoubleClick}
          className="absolute inset-0 z-20 cursor-crosshair"
          title={`Draw ${getToolDisplayName(activeTool)} on chart`}
        >
          <div
            data-drawing-ui="true"
            className="absolute top-3 left-1/2 -translate-x-1/2 tv-glass-popover border border-[var(--tv-accent)] text-[var(--tv-text)] text-xs px-3 py-1 rounded-full flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--tv-accent)]" />
            <span>
              <strong>{getToolDisplayName(activeTool)}</strong>{' '}
              {(() => {
                const m = getToolPointMode(activeTool);
                if (m === 1) return '(Click on chart to place)';
                if (m === 'freehand') return '(Click & drag to draw)';
                if (m === 'multi')
                  return draftStepCount === 0
                    ? '(Click points, double-click or Enter to finish)'
                    : `(${draftStepCount} pts — double-click or Enter to finish)`;
                if (m === 3)
                  return draftStepCount === 0
                    ? '(Click point 1 of 3)'
                    : `(Click point ${draftStepCount + 1} of 3)`;
                return draftStepCount === 0
                  ? '(Click or drag to draw)'
                  : '(Click second point to finish)';
              })()}
            </span>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                draftPointsRef.current = [];
                freehandPointsRef.current = [];
                isFreehandDownRef.current = false;
                setDraftStepCount(0);
                primitiveRef.current?.clearLivePreview();
                onSelectTool('cursor');
              }}
              className="ml-1 text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
            >
              Esc
            </button>
          </div>
        </div>
      )}

      {/* Selected Drawing Floating Properties Toolbar */}
      {selectedDrawing && isActivePane && (
        <DrawingPropertiesBar
          drawing={selectedDrawing}
          templates={drawingTemplates.filter(
            (t) =>
              t.toolGroup ===
              (isLineToolId(selectedDrawing.tool)
                ? 'line'
                : selectedDrawing.tool === 'rectangle'
                ? 'rectangle'
                : 'other')
          )}
          onSaveTemplate={handleSaveDrawingTemplate}
          onApplyTemplate={handleApplyDrawingTemplate}
          onUpdate={onUpdateDrawing}
          onToggleAngleSnap={handleToggleAngleSnap}
          onOpenSettings={(tab = 'style') =>
            setDrawingSettingsState({ drawingId: selectedDrawing.id, tab })
          }
          onClone={onCloneDrawing}
          onDelete={(id) => {
            onRemoveDrawing(id);
            onSelectDrawing(null);
            if (drawingSettingsState?.drawingId === id) {
              setDrawingSettingsState(null);
            }
          }}
          onRequestEditText={(d) => {
            setEditingTextDrawingId(d.id);
            setEditingTextValue(d.text || '');
          }}
          onReorder={onReorderDrawing}
        />
      )}

      {/* Full TradingView Drawing Settings Modal */}
      {settingsModalDrawing && isActivePane && (
        <DrawingSettingsModal
          drawing={settingsModalDrawing}
          initialTab={drawingSettingsState?.tab ?? 'style'}
          tickSize={symbolInfo.tickSize}
          decimals={effectiveDecimals}
          templates={drawingTemplates.filter(
            (t) =>
              t.toolGroup ===
              (isLineToolId(settingsModalDrawing.tool)
                ? 'line'
                : settingsModalDrawing.tool === 'rectangle'
                ? 'rectangle'
                : 'other')
          )}
          onSaveTemplate={handleSaveDrawingTemplate}
          onApplyTemplate={handleApplyDrawingTemplate}
          onUpdate={onUpdateDrawing}
          onToggleAngleSnap={handleToggleAngleSnap}
          onReorder={onReorderDrawing}
          onClose={() => setDrawingSettingsState(null)}
        />
      )}

      {/* TradingView-style Right-Click Context Menu for Drawings */}
      {drawingContextMenu && (() => {
        const ctxDrawing = activeSymbolDrawings.find((d) => d.id === drawingContextMenu.drawingId);
        if (!ctxDrawing) return null;
        return (
          <div
            data-drawing-ui="true"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ left: `${drawingContextMenu.x}px`, top: `${drawingContextMenu.y}px` }}
            className="absolute z-50 w-44 tv-glass-popover border rounded-xl py-1 text-[11.5px] text-[var(--tv-text)] select-none"
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)] border-b border-[var(--tv-border)] mb-0.5 truncate">
              {getToolDisplayName(ctxDrawing.tool)}
            </div>
            <button
              type="button"
              onClick={() => {
                setDrawingSettingsState({ drawingId: ctxDrawing.id, tab: 'style' });
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)] font-medium"
            >
              Settings...
            </button>
            {supportsRichTextTool(ctxDrawing.tool) && (
              <button
                type="button"
                onClick={() => {
                  setDrawingSettingsState({ drawingId: ctxDrawing.id, tab: 'text' });
                  setDrawingContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
              >
                Text Settings...
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingTextDrawingId(ctxDrawing.id);
                setEditingTextValue(ctxDrawing.text || '');
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
            >
              Quick Edit Text...
            </button>
            <button
              type="button"
              onClick={() => {
                onCloneDrawing(ctxDrawing);
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
            >
              Clone
            </button>
            {onReorderDrawing && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onReorderDrawing(ctxDrawing.id, 'front');
                    setDrawingContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
                >
                  Bring to Front
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReorderDrawing(ctxDrawing.id, 'back');
                    setDrawingContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
                >
                  Send to Back
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                onUpdateDrawing({ ...ctxDrawing, locked: !ctxDrawing.locked });
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
            >
              {ctxDrawing.locked ? 'Unlock' : 'Lock'}
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdateDrawing({ ...ctxDrawing, visible: ctxDrawing.visible === false });
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--tv-bg-hover)]"
            >
              {ctxDrawing.visible === false ? 'Show' : 'Hide'}
            </button>
            <div className="my-0.5 border-t border-[var(--tv-border)]" />
            <button
              type="button"
              onClick={() => {
                onRemoveDrawing(ctxDrawing.id);
                onSelectDrawing(null);
                setDrawingContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 text-[var(--tv-bear)] hover:bg-[var(--tv-bg-hover)]"
            >
              Remove
            </button>
          </div>
        );
      })()}

      {/* Inline Floating Multiline Text Editor Modal for Notes, Callouts & Labels */}
      {editingTextDrawingId && (
        <div
          data-drawing-ui="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-12 left-1/2 -translate-x-1/2 z-50 tv-glass-popover border border-[var(--tv-accent)] rounded-xl p-2 flex flex-col gap-1.5 w-[320px]"
        >
          <textarea
            rows={2}
            autoFocus
            value={editingTextValue}
            onChange={(e) => setEditingTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const target = drawings.find((d) => d.id === editingTextDrawingId);
                if (target) {
                  onUpdateDrawing({ ...target, text: editingTextValue.trim() || target.text, showText: true });
                }
                setEditingTextDrawingId(null);
              } else if (e.key === 'Escape') {
                setEditingTextDrawingId(null);
              }
            }}
            placeholder="Enter label or note (Shift+Enter for new line)..."
            aria-label="Drawing Text Input"
            className="w-full px-2 py-1.5 rounded tv-glass-input border text-[11.5px] resize-none focus:outline-none focus:border-[var(--tv-accent)]"
          />
          <div className="flex items-center justify-between text-[10px] text-[var(--tv-text-muted)]">
            <button
              type="button"
              onClick={() => {
                const targetId = editingTextDrawingId;
                setEditingTextDrawingId(null);
                if (targetId) setDrawingSettingsState({ drawingId: targetId, tab: 'text' });
              }}
              className="text-[var(--tv-accent)] hover:underline font-medium"
            >
              Text Settings...
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditingTextDrawingId(null)}
                className="h-6 px-2 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = drawings.find((d) => d.id === editingTextDrawingId);
                  if (target) {
                    onUpdateDrawing({ ...target, text: editingTextValue.trim() || undefined, showText: true });
                  }
                  setEditingTextDrawingId(null);
                }}
                className="h-6 px-2.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[11px] font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Right-Side Price Scale Custom Institutional Badges */}
      <div className="absolute top-0 right-0 bottom-[28px] w-[165px] pointer-events-none z-20 overflow-visible">
        {ivWallsVisible &&
          ivWalls.length >= 7 &&
          (() => {
            const u1Coord = toCoords(0, ivWalls[1]?.price ?? 0).y ?? 200;
            const l1Coord = toCoords(0, ivWalls[5]?.price ?? 0).y ?? 450;
            return ivWalls.map((wall, idx) => {
              const coord = toCoords(processedCandles[processedCandles.length - 1]?.time ?? 0, wall.price);
              if (coord.y === null || coord.y < 8 || coord.y > 820) return null;
              let adjustedY = coord.y;
              if (wall.id === 'iv-u1') adjustedY = u1Coord;
              if (wall.id === 'iv-u2') adjustedY = u1Coord + 17;
              if (wall.id === 'iv-u3') adjustedY = u1Coord + 34;
              if (wall.id === 'iv-u4') adjustedY = u1Coord + 51;
              if (wall.id === 'iv-l1') adjustedY = l1Coord;
              if (wall.id === 'iv-l2') adjustedY = l1Coord + 18;

              return (
                <div
                  key={wall.id || idx}
                  style={{ top: `${adjustedY - 9}px` }}
                  className="absolute right-0.5 flex items-center gap-1"
                >
                  {wall.sigma && (
                    <span
                      className={`text-[9px] font-mono leading-none ${
                        isLight ? 'text-[#434651]' : 'text-[#9598a1]'
                      }`}
                    >
                      {wall.sigma}
                    </span>
                  )}
                  <div
                    style={{ backgroundColor: wall.bgColor, color: wall.textColor }}
                    className="px-1 py-[1.5px] rounded-[2px] text-[10px] font-mono font-semibold leading-none tabular-nums shadow-xs min-w-[60px] text-right"
                  >
                    {formatPrice(wall.price, symbolInfo.decimals)}
                  </div>
                </div>
              );
            });
          })()}

        {/* Current Price & Symbol Tag */}
        {displayCurrentPrice > 0 && currentPriceY !== null && currentPriceY > 10 && currentPriceY < 820 && chartSettings?.symbolLastPriceMode !== 'Line only' && (
          <div
            style={{ top: `${Number(currentPriceY) - 9}px` }}
            className="absolute right-0.5 flex items-start gap-[1px]"
          >
            {(chartSettings?.symbolLastPriceMode ?? 'Name, value, line') === 'Name, value, line' && (
              <div
                style={{ backgroundColor: chartSettings?.lastPriceColor || '#9598a1' }}
                className="text-[#131722] px-1 py-[1.5px] rounded-l-[2px] text-[10px] font-semibold leading-tight tracking-tight whitespace-nowrap"
              >
                {symbolInfo.symbol}
              </div>
            )}
            <div
              style={{ backgroundColor: chartSettings?.lastPriceColor || '#9598a1' }}
              className={`text-[#131722] px-1 py-[1.5px] text-[10.5px] font-mono font-semibold leading-tight tabular-nums text-right min-w-[60px] ${
                (chartSettings?.symbolLastPriceMode ?? 'Name, value, line') === 'Name, value, line' ? 'rounded-r-[2px]' : 'rounded-[2px]'
              }`}
            >
              <div>{formatPrice(displayCurrentPrice, effectiveDecimals)}</div>
              {(chartSettings?.countdownToBarClose ?? true) && (
                <div className="text-[9px] font-normal opacity-90">{countdownText}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Active Trade Positions Overlay on Chart */}
      {(chartSettings?.showPositionsOnChart ?? true) &&
        positions
          .filter((pos) => pos.symbol === symbolInfo.symbol)
          .map((pos) => {
          const coord = toCoords(0, pos.entryPrice);
          if (coord.y === null || coord.y < 20 || coord.y > 800) return null;
          const pnl = calculatePositionPnL(pos, symbolInfo.price);
          const isProfit = pnl.dollarPnL >= 0;
          return (
            <div
              key={pos.id}
              style={{ top: `${coord.y - 12}px` }}
              className="absolute left-[260px] right-[72px] z-20 flex items-center pointer-events-auto"
            >
              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold text-white shadow ${
                  pos.side === 'BUY' ? 'bg-[#2962ff]' : 'bg-[#f23645]'
                }`}
              >
                <span>
                  {pos.side} {pos.qty} @ {formatPrice(pos.entryPrice, symbolInfo.decimals)}
                </span>
                <span
                  className={`px-1 rounded text-[10px] ${
                    isProfit ? 'bg-[#089981]' : 'bg-[#b71c1c]'
                  }`}
                >
                  {isProfit ? '+' : ''}${pnl.dollarPnL.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => onClosePosition(pos.id)}
                  aria-label={`Close ${pos.side} position`}
                  className="hover:opacity-80 ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div
                className={`flex-1 h-[1px] border-t border-dashed ${
                  pos.side === 'BUY' ? 'border-[#2962ff]' : 'border-[#f23645]'
                }`}
              />
            </div>
          );
        })}

      {/* Active Price Alerts Lines on Chart */}
      {(chartSettings?.showAlertsOnChart ?? true) &&
        alerts
          .filter(
            (al) =>
              al.symbol === symbolInfo.symbol &&
              ((chartSettings?.onlyActiveAlerts ?? true) ? al.active : true)
          )
          .map((al) => {
            const coord = toCoords(0, al.targetPrice);
            if (coord.y === null || coord.y < 20 || coord.y > 800) return null;
            const lineCol = chartSettings?.alertLineColor || '#f59e0b';
            return (
              <div
                key={al.id}
                style={{ top: `${coord.y - 9}px` }}
                className="absolute left-[420px] right-[72px] z-10 flex items-center pointer-events-none"
              >
                <span
                  style={{ backgroundColor: lineCol }}
                  className="text-[#0a0a0d] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-l"
                >
                  ALERT {formatPrice(al.targetPrice, effectiveDecimals)}
                </span>
                <div style={{ borderColor: lineCol }} className="flex-1 h-[1px] border-t border-dotted" />
              </div>
            );
          })}

      {/* Top-Left Chart Legend Overlay (Slim Layout & Status Line Settings) */}
      <div className="absolute top-2 left-2.5 z-20 flex flex-col gap-1 max-w-[76%] pointer-events-none">
        {/* Row 1: Symbol Name · Timeframe · Exchange + Market Badge + Live OHLC */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            {chartSettings?.showLogo && (
              <span
                style={{ backgroundColor: symbolInfo.badgeBg, color: symbolInfo.badgeColor || '#fff' }}
                className="w-4 h-4 rounded-full inline-flex items-center justify-center text-[8.5px] font-bold shrink-0"
              >
                {symbolInfo.badgeText}
              </span>
            )}
            {(chartSettings?.showTitle ?? true) && (
              <h1
                className={`${isMultiPane ? 'text-[12px]' : 'text-[13.5px]'} font-semibold text-[var(--tv-text)]`}
              >
                {chartSettings?.titleMode === 'Ticker'
                  ? symbolInfo.symbol
                  : chartSettings?.titleMode === 'Description'
                  ? `${symbolInfo.name} (${symbolInfo.type})`
                  : symbolInfo.name}{' '}
                · {formatTimeframeHeaderLabel(timeframe)} · {symbolInfo.exchange}
              </h1>
            )}
            {/* Live LSE Feed Pill */}
            <span
              title={candleDataSource ? `Data source: ${candleDataSource}` : 'LSE Data 3.0'}
              className="inline-flex items-center gap-0.5 px-1 py-[1px] rounded-full bg-[#089981]/18 border border-[#089981]/40"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
              <span className="text-[9px] font-bold text-[#089981] leading-none">
                {symbolInfo.dataSource === 'lse-live' ? 'LIVE' : 'LSE'}
              </span>
            </span>
          </div>

          {/* OHLC Values */}
          {((chartSettings?.showOhlcValues ?? true) || (chartSettings?.showBarChangeValues ?? true)) && (
            <div className="flex items-center gap-1 text-[11px] font-mono tabular-nums text-[var(--tv-text-secondary)]">
              {(chartSettings?.showOhlcValues ?? true) && (
                <>
                  <span>
                    <span className="text-[var(--tv-text-muted)]">O</span>
                    {formatPrice(displayBar.open, effectiveDecimals)}
                  </span>
                  <span>
                    <span className="text-[var(--tv-text-muted)]">H</span>
                    {formatPrice(displayBar.high, effectiveDecimals)}
                  </span>
                  <span>
                    <span className="text-[var(--tv-text-muted)]">L</span>
                    {formatPrice(displayBar.low, effectiveDecimals)}
                  </span>
                  <span>
                    <span className="text-[var(--tv-text-muted)]">C</span>
                    {formatPrice(displayBar.close, effectiveDecimals)}
                  </span>
                </>
              )}
              {(chartSettings?.showBarChangeValues ?? true) && (
                <span
                  className={
                    displayBar.change >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                  }
                >
                  {displayBar.change >= 0 ? '+' : ''}
                  {formatPrice(displayBar.change, effectiveDecimals)} ({displayBar.change >= 0 ? '+' : ''}
                  {displayBar.changePercent.toFixed(2)}%)
                </span>
              )}
              {chartSettings?.showVolumeInLegend && (
                <span className="text-[var(--tv-text-muted)]">Vol {displayBar.volume.toLocaleString()}</span>
              )}
            </div>
          )}
        </div>

        {/* Row 2: Red SELL / Spread / Blue BUY Quick Order Buttons */}
        {(chartSettings?.showBuySellButtons ?? true) && !isMultiPane && (
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              disabled={symbolInfo.price <= 0}
              onClick={() => onQuickOrder('SELL')}
              aria-label={`Sell ${symbolInfo.symbol} at ${
                symbolInfo.bid > 0 ? formatPrice(symbolInfo.bid * currencyFactor, effectiveDecimals) : '—'
              }`}
              className="flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] border border-[#f23645] tv-glass-card hover:bg-[#f23645]/15 text-[#f23645] transition-colors cursor-pointer disabled:opacity-50 min-w-[62px]"
            >
              <span className="text-[11px] font-mono font-semibold leading-tight tabular-nums">
                {symbolInfo.bid > 0
                  ? formatPrice(symbolInfo.bid * currencyFactor, effectiveDecimals)
                  : displayCurrentPrice > 0
                  ? formatPrice(displayCurrentPrice, effectiveDecimals)
                  : '—'}
              </span>
              <span className="text-[9px] font-semibold tracking-wide leading-none mt-0.5">SELL</span>
            </button>

            <span className="text-[10.5px] font-mono tabular-nums text-[var(--tv-text-muted)]">
              {symbolInfo.spread.toFixed(effectiveDecimals)}
            </span>

            <button
              type="button"
              disabled={symbolInfo.price <= 0}
              onClick={() => onQuickOrder('BUY')}
              aria-label={`Buy ${symbolInfo.symbol} at ${
                symbolInfo.ask > 0 ? formatPrice(symbolInfo.ask * currencyFactor, effectiveDecimals) : '—'
              }`}
              className="flex flex-col items-center justify-center px-2 py-0.5 rounded-[4px] border border-[#2962ff] tv-glass-card hover:bg-[#2962ff]/15 text-[#2962ff] transition-colors cursor-pointer disabled:opacity-50 min-w-[62px]"
            >
              <span className="text-[11px] font-mono font-semibold leading-tight tabular-nums">
                {symbolInfo.ask > 0
                  ? formatPrice(symbolInfo.ask * currencyFactor, effectiveDecimals)
                  : displayCurrentPrice > 0
                  ? formatPrice(displayCurrentPrice, effectiveDecimals)
                  : '—'}
              </span>
              <span className="text-[9px] font-semibold tracking-wide leading-none mt-0.5">BUY</span>
            </button>
          </div>
        )}

        {/* Compare Overlays Legend Chips */}
        {compareOverlays.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pointer-events-auto">
            {compareOverlays.map((ov) => (
              <div
                key={ov.symbol}
                className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10.5px] border tv-glass-card text-[var(--tv-text)]"
              >
                <span style={{ backgroundColor: ov.color }} className="w-2 h-2 rounded-full" />
                <span className="font-semibold">{ov.symbol}</span>
                {onRemoveCompareOverlay && (
                  <button
                    type="button"
                    onClick={() => onRemoveCompareOverlay(ov.symbol)}
                    aria-label={`Remove compare overlay ${ov.symbol}`}
                    className="text-[#787b86] hover:text-[#f23645]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Row 3+: Collapsible Indicator Status Rows */}
        {(chartSettings?.showIndicatorsLegend ?? true) && legendExpanded && !isMultiPane && (
          <div className="flex flex-col gap-0.5 pointer-events-auto">
            {indicators
              .filter((ind) => !ind.removed && (ind.category === 'institutional' || ind.visible))
              .map((ind) => {
                const isGexRow = ind.id === 'gex-levels';
                const isOrderflowRow = ind.id === 'orderflow-delta';
                const isAbsorbRow = ind.id === 'absorption-delta';
                const isVpRow = ind.id === 'volume-profile';
                let liveParams = ind.paramsText;
                if (isGexRow) {
                  if (!gexResolvedInfo) {
                    liveParams = 'US Equities, ETFs & Index Futures';
                  } else if (ind.visible && gexLoading && !gexData) {
                    liveParams = `Loading ${gexResolvedInfo.underlying} OPRA...`;
                  } else if (ind.visible && gexError) {
                    liveParams = gexError;
                  } else if (ind.visible && gexData) {
                    const cw = gexData.metrics.callWall
                      ? `CW ${formatPrice(gexData.metrics.callWall * gexSpotScaleRatio, effectiveDecimals)}`
                      : '';
                    const pw = gexData.metrics.putWall
                      ? `PW ${formatPrice(gexData.metrics.putWall * gexSpotScaleRatio, effectiveDecimals)}`
                      : '';
                    const zf = gexData.metrics.zeroGammaFlip
                      ? `ZF ${formatPrice(gexData.metrics.zeroGammaFlip * gexSpotScaleRatio, effectiveDecimals)}`
                      : '';
                    const horizonTag =
                      gexData.horizonUsed === 'weekly_strip'
                        ? '0-5D Weekly'
                        : gexData.horizonUsed === '1w'
                        ? `1W (${gexData.selectedExpiry.slice(5)})`
                        : gexData.horizonUsed === 'monthly'
                        ? `Mthly (${gexData.selectedExpiry.slice(5)})`
                        : gexData.horizonUsed === 'next_monthly'
                        ? `Next Mthly (${gexData.selectedExpiry.slice(5)})`
                        : gexData.horizonUsed === 'all'
                        ? 'All Exp'
                        : gexData.selectedDte === 0
                        ? `0DTE (${gexData.selectedExpiry.slice(5)})`
                        : `${gexData.selectedDte}DTE (${gexData.selectedExpiry.slice(5)})`;
                    const prefix = gexResolvedInfo.isFuturesProxy
                      ? `${gexResolvedInfo.underlying} Proxy ${horizonTag} · `
                      : `${horizonTag} · `;
                    liveParams = prefix + [cw, pw, zf].filter(Boolean).join(' · ');
                  }
                } else if (isOrderflowRow) {
                  const fmtVol = (v: number) =>
                    Math.abs(v) >= 1_000_000
                      ? `${(v / 1_000_000).toFixed(2)}M`
                      : Math.abs(v) >= 1_000
                      ? `${(v / 1_000).toFixed(1)}K`
                      : Math.round(v).toString();
                  liveParams = `Δ ${orderflowSummary.latestDelta >= 0 ? '+' : ''}${fmtVol(
                    orderflowSummary.latestDelta
                  )} · CVD ${orderflowSummary.latestCvd >= 0 ? '+' : ''}${fmtVol(
                    orderflowSummary.latestCvd
                  )} · Buy ${orderflowSummary.buyPct}%`;
                } else if (isAbsorbRow) {
                  liveParams = `Bid Abs ${orderflowSummary.bullAbsorptions} · Ask Abs ${orderflowSummary.bearAbsorptions} · Div ${orderflowSummary.divergences}`;
                } else if (isVpRow) {
                  if (vpHistoryLoading) {
                    liveParams =
                      volumeProfileConfig.periodMode === 'prev_week'
                        ? 'Loading Prev Week...'
                        : 'Loading Prev Day...';
                  } else if (vpVisible && periodVolumeProfile && periodVolumeProfile.totalVolume > 0) {
                    liveParams = `${periodVolumeProfile.periodLabel || 'Prev Session'} · POC ${formatPrice(
                      periodVolumeProfile.pocPrice,
                      effectiveDecimals
                    )} · VAH ${formatPrice(
                      periodVolumeProfile.vahPrice,
                      effectiveDecimals
                    )} · VAL ${formatPrice(
                      periodVolumeProfile.valPrice,
                      effectiveDecimals
                    )}`;
                  } else if (ind.visible && !isActivePane) {
                    liveParams = 'Focus pane to compute';
                  } else {
                    const pLbl = volumeProfileConfig.periodMode === 'prev_week' ? 'Prev Week' : 'Prev Day';
                    liveParams = `${pLbl} · ${Math.round(volumeProfileConfig.valueAreaPct * 100)}% VA · ${
                      volumeProfileConfig.rowCount
                    } rows`;
                  }
                }

                return (
                  <div
                    key={ind.id}
                    className={`flex items-center gap-1.5 text-[11px] leading-tight ${
                      ind.visible
                        ? 'text-[var(--tv-text)]'
                        : 'text-[var(--tv-text-muted)]'
                    }`}
                  >
                    <span className="truncate max-w-[640px] tabular-nums">
                      <span className={ind.visible ? 'font-medium' : ''}>{ind.shortTitle}</span>{' '}
                      {liveParams && (
                        <span className="text-[var(--tv-text-muted)] font-normal">{liveParams}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleIndicatorVisibility(ind.id)}
                      aria-label={`Toggle ${ind.name} visibility`}
                      title={ind.visible ? `Hide ${ind.name}` : `Show ${ind.name}`}
                      className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] transition-colors shrink-0"
                    >
                      {ind.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    {isGexRow && (
                      <button
                        type="button"
                        onClick={() => setGexMenuOpen((v) => !v)}
                        aria-label="Configure GEX Levels on Chart"
                        title="Configure GEX Levels (Call Wall, Put Wall, Zero Gamma, HVL, 1D EM)"
                        className="text-[var(--tv-text-muted)] hover:text-[var(--tv-accent)] transition-colors shrink-0"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                    {isVpRow && (
                      <button
                        type="button"
                        onClick={() => setVpMenuOpen((v) => !v)}
                        aria-label="Configure Volume Profile Settings"
                        title="Configure Volume Profile (VA %, Rows, Placement, POC)"
                        className="text-[var(--tv-text-muted)] hover:text-[var(--tv-accent)] transition-colors shrink-0"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                    )}
                    {onRemoveIndicator && (
                      <button
                        type="button"
                        onClick={() => onRemoveIndicator(ind.id)}
                        aria-label={`Delete ${ind.name} indicator`}
                        title={`Delete ${ind.name} from chart`}
                        className="text-[var(--tv-text-muted)] hover:text-[#f23645] transition-colors shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Collapse / Expand Legend Button "^" */}
        {(chartSettings?.showIndicatorsLegend ?? true) && !isMultiPane && (
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setLegendExpanded((v) => !v)}
              aria-label={legendExpanded ? 'Collapse Indicator Legend' : 'Expand Indicator Legend'}
              className="w-5 h-4 rounded border tv-glass-card text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] flex items-center justify-center transition-colors"
            >
              {legendExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Top-Right Direct On-Chart Volume Profile + GEX Levels + Tooltip Toggle + Currency Unit */}
      {(chartSettings?.currencyUnitVisibility ?? 'Always visible') !== 'Hidden' && (
        <div className="absolute top-1.5 right-[72px] z-30 flex items-center gap-1" ref={gexMenuRef}>
          {(!isMultiPane || isActivePane) && (
            <div className="relative flex items-center" ref={vpMenuRef}>
              <div
                className={`h-5 rounded border text-[10.5px] flex items-center overflow-hidden backdrop-blur-md transition-colors ${
                  vpVisible
                    ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)] font-semibold'
                    : 'tv-glass-card text-[var(--tv-text-secondary)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleIndicatorVisibility('volume-profile')}
                  aria-label={vpVisible ? 'Hide Volume Profile' : 'Show Volume Profile'}
                  title="Toggle Previous Day / Previous Week Volume Profile (VA & POC)"
                  className="px-1.5 h-full flex items-center gap-1 hover:opacity-85 transition-opacity whitespace-nowrap"
                >
                  <AlignRight className="w-2.5 h-2.5" />
                  <span>
                    {vpVisible
                      ? volumeProfileConfig.periodMode === 'prev_week'
                        ? 'VP ON · PW'
                        : 'VP ON · PD'
                      : 'VP'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVpMenuOpen((v) => !v)}
                  aria-label="Volume Profile Options"
                  aria-expanded={vpMenuOpen}
                  title="Configure Volume Profile (Prev Day/Week, VA %, Rows, Placement)"
                  className={`px-1 h-full border-l flex items-center justify-center hover:bg-[var(--tv-bg-hover)] ${
                    vpVisible ? 'border-[var(--tv-accent-border)]' : 'border-[var(--tv-border-glass)]'
                  }`}
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>

              {vpMenuOpen && onUpdateVolumeProfileConfig && (
                <div
                  data-drawing-ui="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 w-72 tv-glass-popover border rounded-xl p-2.5 text-[11px] text-[var(--tv-text-secondary)] z-50 space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-[var(--tv-border)] pb-1.5">
                    <div>
                      <div className="text-[11.5px] font-semibold text-[var(--tv-text)]">
                        Volume Profile ({volumeProfileConfig.periodMode === 'prev_week' ? 'Previous Week' : 'Previous Day'})
                      </div>
                      <div className="text-[10px] font-mono text-[var(--tv-text-muted)] tabular-nums">
                        {vpHistoryLoading
                          ? 'Loading historical LSE session...'
                          : vpVisible && periodVolumeProfile
                          ? `${periodVolumeProfile.periodLabel || 'Prev Session'} · Vol ${Math.round(
                              periodVolumeProfile.totalVolume
                            ).toLocaleString()}`
                          : 'Previous session candles'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleIndicatorVisibility('volume-profile')}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        vpIndicatorEnabled
                          ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                          : 'tv-glass-card border text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
                      }`}
                    >
                      {vpIndicatorEnabled ? 'Visible' : 'Off'}
                    </button>
                  </div>

                  {vpVisible && periodVolumeProfile && periodVolumeProfile.totalVolume > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-lg tv-glass-card border text-[10px] font-mono tabular-nums">
                      <div>
                        <div className="text-[var(--tv-text-muted)]">VAH</div>
                        <div className="text-[#38bdf8] font-semibold">
                          {formatPrice(periodVolumeProfile.vahPrice, effectiveDecimals)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--tv-text-muted)]">POC</div>
                        <div className="text-[#f23645] font-semibold">
                          {formatPrice(periodVolumeProfile.pocPrice, effectiveDecimals)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--tv-text-muted)]">VAL</div>
                        <div className="text-[#38bdf8] font-semibold">
                          {formatPrice(periodVolumeProfile.valPrice, effectiveDecimals)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--tv-text-muted)]">Period</span>
                      <div className="flex items-center gap-1">
                        {(
                          [
                            { id: 'prev_day', label: 'Prev Day' },
                            { id: 'prev_week', label: 'Prev Week' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (!vpIndicatorEnabled) onToggleIndicatorVisibility('volume-profile');
                              onUpdateVolumeProfileConfig({ periodMode: opt.id });
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              volumeProfileConfig.periodMode === opt.id
                                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                                : 'tv-glass-card text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--tv-text-muted)]">Histogram Rows</span>
                      <div className="flex items-center gap-1">
                        {[24, 32, 48, 64].map((rows) => (
                          <button
                            key={rows}
                            type="button"
                            onClick={() => {
                              if (!vpIndicatorEnabled) onToggleIndicatorVisibility('volume-profile');
                              onUpdateVolumeProfileConfig({ rowCount: rows });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              volumeProfileConfig.rowCount === rows
                                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                                : 'tv-glass-card text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            {rows}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--tv-text-muted)]">Value Area %</span>
                      <div className="flex items-center gap-1">
                        {[0.68, 0.7, 0.8].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              if (!vpIndicatorEnabled) onToggleIndicatorVisibility('volume-profile');
                              onUpdateVolumeProfileConfig({ valueAreaPct: pct });
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              Math.abs(volumeProfileConfig.valueAreaPct - pct) < 0.005
                                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                                : 'tv-glass-card text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            {Math.round(pct * 100)}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--tv-text-muted)]">Side</span>
                      <div className="flex items-center gap-1">
                        {(['right', 'left'] as const).map((side) => (
                          <button
                            key={side}
                            type="button"
                            onClick={() => {
                              if (!vpIndicatorEnabled) onToggleIndicatorVisibility('volume-profile');
                              onUpdateVolumeProfileConfig({ placement: side });
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] capitalize ${
                              volumeProfileConfig.placement === side
                                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                                : 'tv-glass-card text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            {side}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-[var(--tv-border)] pt-1.5">
                    {(
                      [
                        {
                          key: 'showValueArea',
                          label: 'Show Value Area (VAH / VAL + Zone)',
                          color: '#2962ff',
                        },
                        {
                          key: 'showPoc',
                          label: 'Show Point of Control (POC)',
                          color: '#f23645',
                        },
                        {
                          key: 'showUpDownSplit',
                          label: 'Buy / Sell Volume Split Bars',
                          color: '#f59e0b',
                        },
                        {
                          key: 'showLabels',
                          label: 'Show POC / VAH / VAL Labels',
                          color: '#38bdf8',
                        },
                      ] as const
                    ).map((item) => {
                      const checked = Boolean(volumeProfileConfig[item.key]);
                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (!vpIndicatorEnabled) {
                                onToggleIndicatorVisibility('volume-profile');
                              }
                              onUpdateVolumeProfileConfig({ [item.key]: !checked });
                            }}
                            className="rounded border-[var(--tv-border)] bg-[var(--tv-bg-input)] accent-[var(--tv-accent)]"
                          />
                          <span
                            style={{ backgroundColor: item.color }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="truncate">{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isMultiPane && (
            <button
              type="button"
              onClick={() => {
                const nextEnable = !orderflowVisible;
                onToggleIndicatorVisibility('orderflow-delta');
                if (nextEnable !== absorptionVisible) {
                  onToggleIndicatorVisibility('absorption-delta');
                }
              }}
              aria-label={orderflowVisible ? 'Hide Orderflow & Absorption Delta' : 'Show Orderflow & Absorption Delta'}
              title="Toggle Bar Delta, Cumulative Volume Delta (CVD) Sub-Pane & Passive Absorption Markers"
              className={`h-5 px-1.5 rounded border text-[10.5px] flex items-center gap-1 transition-colors backdrop-blur-md whitespace-nowrap ${
                orderflowVisible || absorptionVisible
                  ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)] font-semibold'
                  : 'tv-glass-card text-[var(--tv-text-secondary)]'
              }`}
            >
              <BarChart2 className="w-2.5 h-2.5" />
              <span>{orderflowVisible ? 'Orderflow ON' : 'Orderflow'}</span>
            </button>
          )}

          {!isMultiPane && onToggleGexIndicator && (
            <div className="relative flex items-center">
              <div
                className={`h-5 rounded border text-[10.5px] flex items-center overflow-hidden backdrop-blur-md transition-colors ${
                  gexIndicatorVisible
                    ? 'bg-[#089981]/14 border-[#089981] text-[#089981] font-semibold'
                    : 'tv-glass-card text-[var(--tv-text-secondary)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onToggleGexIndicator();
                  }}
                  aria-label={
                    gexIndicatorVisible
                      ? 'Hide GEX Levels on Chart'
                      : 'Add GEX Levels to Chart'
                  }
                  title={
                    gexResolvedInfo
                      ? `Toggle OPRA GEX Levels (${gexResolvedInfo.underlying}) on Chart`
                      : 'Toggle Options GEX Levels (US Stocks/ETFs & Index Futures)'
                  }
                  className="px-1.5 h-full flex items-center gap-1 hover:opacity-85 transition-opacity whitespace-nowrap"
                >
                  <span>{gexIndicatorVisible ? 'GEX ON' : '+ GEX'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGexMenuOpen((v) => !v)}
                  aria-label="GEX Overlay Options"
                  aria-expanded={gexMenuOpen}
                  title="Customize GEX Levels on Chart"
                  className={`px-1 h-full border-l flex items-center justify-center hover:bg-[var(--tv-bg-hover)] ${
                    gexIndicatorVisible
                      ? 'border-[#089981]/40'
                      : 'border-[var(--tv-border-glass)]'
                  }`}
                >
                  <ChevronDown className="w-2.5 h-2.5" />
                </button>
              </div>

              {gexMenuOpen && gexOverlayConfig && onUpdateGexConfig && (
                <div
                  data-drawing-ui="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 w-72 tv-glass-popover border rounded-xl p-2.5 text-[11px] text-[var(--tv-text-secondary)] z-50 space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-[var(--tv-border)] pb-1.5">
                    <div>
                      <div className="text-[11.5px] font-semibold text-[var(--tv-text)]">
                        On-Chart Options GEX Levels
                      </div>
                      <div className="text-[10px] font-mono text-[var(--tv-text-muted)] tabular-nums">
                        {gexResolvedInfo
                          ? gexResolvedInfo.isFuturesProxy
                            ? `${symbolInfo.symbol} via ${gexResolvedInfo.underlying} · ${
                                gexData?.expiryRangeLabel || '0DTE'
                              } · ${gexOverlayConfig.dynamicSpotTracking ? 'Live Γ' : 'Static'}`
                            : `${gexResolvedInfo.underlying} · ${
                                gexData?.expiryRangeLabel ||
                                (gexData ? (gexData.selectedDte === 0 ? '0DTE' : `${gexData.selectedDte}DTE`) : '0DTE')
                              } · ${gexOverlayConfig.dynamicSpotTracking ? 'Live Γ' : 'Static'}`
                          : 'Switch to US Stock/ETF (QQQ, SPY) or US Index'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {onRefreshGex && gexResolvedInfo && (
                        <button
                          type="button"
                          onClick={onRefreshGex}
                          aria-label="Refresh GEX Levels"
                          title="Refresh live OPRA GEX data"
                          className="p-1 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
                        >
                          <RefreshCw className={`w-3 h-3 ${gexLoading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleGexIndicator()}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          gexIndicatorVisible
                            ? 'bg-[#089981] text-white'
                            : 'tv-glass-card border text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
                        }`}
                      >
                        {gexIndicatorVisible ? 'Visible' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {!gexResolvedInfo ? (
                    <div className="py-2 text-[10.5px] text-[var(--tv-text-muted)] leading-relaxed">
                      OPRA dealer gamma overlays are available on US stocks/ETFs (e.g. QQQ, SPY, NVDA, AAPL) and mapped US index futures (NASDAQ100, SP500, DOW).
                    </div>
                  ) : (
                    <>
                      {gexError && (
                        <div className="px-2 py-1 rounded bg-[#f23645]/15 border border-[#f23645]/40 text-[#f23645] text-[10.5px]">
                          {gexError}
                        </div>
                      )}

                      <div className="space-y-1">
                        {(
                          [
                            {
                              key: 'showCallWall',
                              label: 'Call Wall (Resistance)',
                              color: '#089981',
                              val: gexData?.metrics.callWall,
                            },
                            {
                              key: 'showPutWall',
                              label: 'Put Wall (Support)',
                              color: '#f23645',
                              val: gexData?.metrics.putWall,
                            },
                            {
                              key: 'showZeroGamma',
                              label: 'Zero Gamma Flip',
                              color: '#f59e0b',
                              val: gexData?.metrics.zeroGammaFlip,
                            },
                            {
                              key: 'showHvlPin',
                              label: 'HVL / Max Pin Strike',
                              color: '#2962ff',
                              val: gexData?.metrics.hvlStrike ?? gexData?.metrics.maxPinStrike,
                            },
                            {
                              key: 'showExpectedMove',
                              label:
                                gexData && gexData.selectedDte > 1
                                  ? `${gexData.selectedDte}D Expected Move (±1σ)`
                                  : '1D Expected Move (±1σ)',
                              color: '#a855f7',
                              val: gexData?.metrics.expectedMove1D,
                              isDelta: true,
                            },
                            {
                              key: 'showStrikeHistogram',
                              label: 'Strike GEX Profile Bars',
                              color: '#26a69a',
                              val: null,
                              textVal: gexData ? `${gexData.strikes.length} strikes` : null,
                            },
                            {
                              key: 'showSecondaryWalls',
                              label: 'Secondary Walls (CW2/PW2)',
                              color: '#787b86',
                              val: null,
                              textVal:
                                gexData &&
                                (gexData.metrics.secondaryCallWalls[0] || gexData.metrics.secondaryPutWalls[0])
                                  ? `${
                                      gexData.metrics.secondaryCallWalls[0]
                                        ? formatPrice(
                                            gexData.metrics.secondaryCallWalls[0] *
                                              gexSpotScaleRatio *
                                              currencyFactor,
                                            effectiveDecimals
                                          )
                                        : '—'
                                    } / ${
                                      gexData.metrics.secondaryPutWalls[0]
                                        ? formatPrice(
                                            gexData.metrics.secondaryPutWalls[0] *
                                              gexSpotScaleRatio *
                                              currencyFactor,
                                            effectiveDecimals
                                          )
                                        : '—'
                                    }`
                                  : null,
                            },
                          ] as Array<{
                            key: keyof GexChartOverlayConfig;
                            label: string;
                            color: string;
                            val?: number | null;
                            isDelta?: boolean;
                            textVal?: string | null;
                          }>
                        ).map((row) => {
                          const checked = Boolean(gexOverlayConfig[row.key]);
                          const scaledVal =
                            row.val !== null && row.val !== undefined
                              ? row.val * gexSpotScaleRatio * currencyFactor
                              : null;
                          return (
                            <label
                              key={String(row.key)}
                              className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    if (!gexIndicatorVisible) onToggleGexIndicator();
                                    onUpdateGexConfig({ [row.key]: !checked });
                                  }}
                                  className="rounded border-[var(--tv-border)] bg-[var(--tv-bg-input)] accent-[var(--tv-accent)]"
                                />
                                <span
                                  style={{ backgroundColor: row.color }}
                                  className="w-2 h-2 rounded-full shrink-0"
                                />
                                <span className="truncate">{row.label}</span>
                              </span>
                              <span className="font-mono text-[10px] text-[var(--tv-text-muted)] tabular-nums shrink-0">
                                {scaledVal !== null
                                  ? `${row.isDelta ? '±' : ''}${formatPrice(scaledVal, effectiveDecimals)}`
                                  : row.textVal ?? '—'}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      {/* Horizon Selector + Dynamic Spot Re-Gamma & Expiry Picker */}
                      <div className="pt-1 border-t border-[var(--tv-border)] space-y-1.5">
                        <div className="px-1.5 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-[var(--tv-text-muted)]">
                            <span>GEX Horizon</span>
                            {gexData?.sessionDateEt && (
                              <span className="font-mono">Session {gexData.sessionDateEt}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-5 gap-0.5 tv-glass-input p-0.5 rounded border">
                            {(
                              [
                                { id: '0dte', label: '0DTE', title: 'Same-day / Nearest session expiry' },
                                { id: '1w', label: '1W (5D)', title: 'Next 1 Week (5 trading days) expiry' },
                                { id: 'weekly_strip', label: '0–5D', title: 'Cumulative 0–5 Trading Days strip' },
                                { id: 'monthly', label: 'Monthly', title: 'Upcoming Monthly OpEx (3rd Friday)' },
                                { id: 'all', label: 'All', title: 'All key active expiries combined' },
                              ] as const
                            ).map((hz) => {
                              const activeHz = (gexOverlayConfig.expiryMode || '0dte') === hz.id;
                              return (
                                <button
                                  key={hz.id}
                                  type="button"
                                  title={hz.title}
                                  onClick={() => {
                                    if (!gexIndicatorVisible) onToggleGexIndicator();
                                    onUpdateGexConfig({ expiryMode: hz.id });
                                  }}
                                  className={`py-1 rounded text-[9.5px] font-semibold transition-colors ${
                                    activeHz
                                      ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                                      : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
                                  }`}
                                >
                                  {hz.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {gexData && gexData.expiries.length > 0 && (
                          <div className="flex items-center justify-between gap-2 px-1.5">
                            <span className="text-[10.5px] text-[var(--tv-text-muted)]">Exact Expiry</span>
                            <select
                              value={
                                /^\d{4}-\d{2}-\d{2}$/.test(gexOverlayConfig.expiryMode || '') &&
                                gexData.expiries.some((ex) => ex.expiry === gexOverlayConfig.expiryMode)
                                  ? gexOverlayConfig.expiryMode
                                  : gexData.selectedExpiry || ''
                              }
                              onChange={(e) => {
                                if (!gexIndicatorVisible) onToggleGexIndicator();
                                onUpdateGexConfig({ expiryMode: e.target.value });
                              }}
                              aria-label="GEX Overlay Expiration"
                              className="h-6 px-1.5 rounded tv-glass-input border text-[10.5px] font-mono focus:outline-none focus:border-[var(--tv-accent)] max-w-[165px]"
                            >
                              {gexData.expiries.map((ex) => (
                                <option key={ex.expiry} value={ex.expiry}>
                                  {ex.expiry} ({ex.dte === 0 ? '0DTE' : ex.dte < 0 ? 'Exp' : `${ex.dte}DTE`}
                                  {ex.tag && ex.tag !== '0DTE' ? ` · ${ex.tag}` : ''})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <label className="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer">
                          <span className="text-[10.5px] text-[var(--tv-text-secondary)]">
                            Dynamic Spot Wall Tracking (Off = Static)
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(gexOverlayConfig.dynamicSpotTracking)}
                            onChange={() =>
                              onUpdateGexConfig({
                                dynamicSpotTracking: !gexOverlayConfig.dynamicSpotTracking,
                              })
                            }
                            className="rounded border-[var(--tv-border)] bg-[var(--tv-bg-input)] accent-[var(--tv-accent)]"
                          />
                        </label>
                      </div>

                      {onOpenGexModal && (
                        <button
                          type="button"
                          onClick={() => {
                            setGexMenuOpen(false);
                            onOpenGexModal();
                          }}
                          className="w-full py-1.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[11px] font-semibold transition-opacity"
                        >
                          Open Options GEX &amp; Orderflow Dashboard
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {!isMultiPane && (
            <button
              type="button"
              onClick={() => setFloatingTooltipEnabled((v) => !v)}
              aria-label="Toggle Floating Crosshair Tooltip"
              title={floatingTooltipEnabled ? 'Hide Floating Tooltip HUD' : 'Show Floating Tooltip HUD'}
              className={`h-5 px-1.5 rounded border text-[10.5px] flex items-center gap-1 transition-colors backdrop-blur-md ${
                floatingTooltipEnabled
                  ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)] font-medium'
                  : 'tv-glass-card text-[var(--tv-text-muted)]'
              }`}
            >
              <Info className="w-2.5 h-2.5" />
              <span>Tooltip</span>
            </button>
          )}

          <select
            value={currencyUnit}
            onChange={(e) => setCurrencyUnit(e.target.value)}
            aria-label="Chart Currency Unit"
            className="h-5 px-1.5 rounded border tv-glass-input text-[10.5px] font-medium focus:outline-none backdrop-blur-md"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="PTS">PTS</option>
          </select>
        </div>
      )}

      {/* Floating Crosshair Tooltip HUD (draggable & pinnable anywhere on chart) */}
      {(() => {
        const activeTooltipBar = hoverData || (tooltipPinnedPos ? displayBar : null);
        if (!isActivePane || !floatingTooltipEnabled || !activeTooltipBar || activeTooltipBar.time <= 0) return null;

        const containerW = containerRef.current?.clientWidth ?? 900;
        const containerH = containerRef.current?.clientHeight ?? 600;
        const cardW = 188;
        const cardH = activeTooltipBar.vwap ? 174 : 156;
        const maxLeft = Math.max(12, containerW - cardW - 64);
        const maxTop = Math.max(44, containerH - cardH - 36);

        let leftPos: number;
        let topPos: number;
        if (tooltipPinnedPos) {
          leftPos = Math.min(Math.max(8, tooltipPinnedPos.x), maxLeft);
          topPos = Math.min(Math.max(40, tooltipPinnedPos.y), maxTop);
        } else if ((isHoveringTooltipRef.current || isDraggingTooltipRef.current) && frozenTooltipCoordsRef.current) {
          leftPos = frozenTooltipCoordsRef.current.x;
          topPos = frozenTooltipCoordsRef.current.y;
        } else if (hoverData) {
          leftPos = Math.min(Math.max(14, hoverData.x + 16), maxLeft);
          topPos = Math.min(Math.max(82, hoverData.y - 60), maxTop);
          frozenTooltipCoordsRef.current = { x: leftPos, y: topPos };
        } else {
          leftPos = 16;
          topPos = 96;
        }

        const handleTooltipPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          e.stopPropagation();
          e.preventDefault();
          isDraggingTooltipRef.current = true;
          const startClientX = e.clientX;
          const startClientY = e.clientY;
          const origLeft = leftPos;
          const origTop = topPos;

          const onPointerMove = (moveEvt: PointerEvent) => {
            if (!isDraggingTooltipRef.current) return;
            const cW = containerRef.current?.clientWidth ?? 900;
            const cH = containerRef.current?.clientHeight ?? 600;
            const mLeft = Math.max(12, cW - cardW - 64);
            const mTop = Math.max(44, cH - cardH - 36);
            const nextX = Math.min(Math.max(8, origLeft + (moveEvt.clientX - startClientX)), mLeft);
            const nextY = Math.min(Math.max(40, origTop + (moveEvt.clientY - startClientY)), mTop);
            if (tooltipDragRafRef.current !== null) cancelAnimationFrame(tooltipDragRafRef.current);
            tooltipDragRafRef.current = requestAnimationFrame(() => {
              setTooltipPinnedPos({ x: Math.round(nextX), y: Math.round(nextY) });
            });
          };

          const onPointerUp = () => {
            isDraggingTooltipRef.current = false;
            if (tooltipDragRafRef.current !== null) {
              cancelAnimationFrame(tooltipDragRafRef.current);
              tooltipDragRafRef.current = null;
            }
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
          };

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerUp);
        };

        return (
          <div
            ref={tooltipRef}
            data-drawing-ui="true"
            role="dialog"
            aria-label="Floating OHLC Tooltip"
            onPointerEnter={() => {
              isHoveringTooltipRef.current = true;
            }}
            onPointerLeave={() => {
              isHoveringTooltipRef.current = false;
            }}
            onPointerDown={handleTooltipPointerDown}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${cardW}px`,
            }}
            className="absolute z-30 rounded-lg p-2 text-[10.5px] pointer-events-auto cursor-grab active:cursor-grabbing select-none tv-glass-popover border text-[var(--tv-text-secondary)]"
          >
            <div
              onDoubleClick={() => {
                setTooltipPinnedPos(null);
                frozenTooltipCoordsRef.current = null;
              }}
              className="flex items-center justify-between gap-1 border-b border-[var(--tv-border)] pb-1 mb-1 text-[10px] font-mono text-[var(--tv-text-muted)]"
            >
              <div className="flex items-center gap-1 min-w-0">
                <svg viewBox="0 0 10 14" className="w-2 h-2.5 opacity-60 shrink-0" fill="currentColor">
                  <circle cx="2.5" cy="2.5" r="1.1" />
                  <circle cx="7.5" cy="2.5" r="1.1" />
                  <circle cx="2.5" cy="7" r="1.1" />
                  <circle cx="7.5" cy="7" r="1.1" />
                  <circle cx="2.5" cy="11.5" r="1.1" />
                  <circle cx="7.5" cy="11.5" r="1.1" />
                </svg>
                <span className="truncate font-semibold">{symbolInfo.symbol} · {timeframe}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span>
                  {new Date(activeTooltipBar.time * 1000).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: isSecondsTf ? '2-digit' : undefined,
                    hour12: true,
                    timeZone: resolvedIanaTz,
                  })}
                </span>
                {tooltipPinnedPos && (
                  <button
                    type="button"
                    aria-label="Follow crosshair"
                    title="Snap back to follow crosshair"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTooltipPinnedPos(null);
                      frozenTooltipCoordsRef.current = null;
                    }}
                    className="p-0.5 rounded hover:bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Hide Floating Tooltip"
                  title="Hide Tooltip"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    isHoveringTooltipRef.current = false;
                    setFloatingTooltipEnabled(false);
                  }}
                  className="p-0.5 rounded hover:bg-[#f23645]/15 hover:text-[#f23645]"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-0.5 text-[10.5px] font-mono tabular-nums">
              <span className="text-[var(--tv-text-muted)]">Open</span>
              <span className="text-right text-[var(--tv-text)]">
                {formatPrice(activeTooltipBar.open, symbolInfo.decimals)}
              </span>
              <span className="text-[var(--tv-text-muted)]">High</span>
              <span className="text-right text-[var(--tv-text)]">
                {formatPrice(activeTooltipBar.high, symbolInfo.decimals)}
              </span>
              <span className="text-[var(--tv-text-muted)]">Low</span>
              <span className="text-right text-[var(--tv-text)]">
                {formatPrice(activeTooltipBar.low, symbolInfo.decimals)}
              </span>
              <span className="text-[var(--tv-text-muted)]">Close</span>
              <span className="text-right font-semibold text-[var(--tv-text)]">
                {formatPrice(activeTooltipBar.close, symbolInfo.decimals)}
              </span>
              <span className="text-[var(--tv-text-muted)]">Change</span>
              <span
                className={`text-right font-semibold ${
                  activeTooltipBar.change >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                }`}
              >
                {activeTooltipBar.change >= 0 ? '+' : ''}
                {formatPrice(activeTooltipBar.change, symbolInfo.decimals)} ({activeTooltipBar.changePercent.toFixed(2)}%)
              </span>
              <span className="text-[var(--tv-text-muted)]">Volume</span>
              <span className="text-right text-[var(--tv-text-secondary)]">
                {activeTooltipBar.volume.toLocaleString()}
              </span>
              {activeTooltipBar.vwap && (
                <>
                  <span className="text-[#ff9800]">VWAP</span>
                  <span className="text-right text-[#ff9800]">
                    {formatPrice(activeTooltipBar.vwap, symbolInfo.decimals)}
                  </span>
                </>
              )}
              {(orderflowVisible || absorptionVisible) && activeTooltipBar.delta !== undefined && (
                <>
                  <span className="text-[var(--tv-text-muted)]">Bar Δ</span>
                  <span
                    className={`text-right font-semibold ${
                      activeTooltipBar.delta >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                    }`}
                  >
                    {activeTooltipBar.delta >= 0 ? '+' : ''}
                    {Math.round(activeTooltipBar.delta).toLocaleString()}
                  </span>
                  <span className="text-[var(--tv-text-muted)]">CVD</span>
                  <span className="text-right text-[#38bdf8]">
                    {(activeTooltipBar.cvd ?? 0) >= 0 ? '+' : ''}
                    {Math.round(activeTooltipBar.cvd ?? 0).toLocaleString()}
                  </span>
                  {activeTooltipBar.absorption && (
                    <>
                      <span className="text-[var(--tv-text-muted)]">Absorption</span>
                      <span
                        className={`text-right font-bold ${
                          activeTooltipBar.absorption === 'bull' ? 'text-[#089981]' : 'text-[#f23645]'
                        }`}
                      >
                        {activeTooltipBar.absorption === 'bull' ? 'Bid Absorb' : 'Ask Absorb'}
                      </span>
                    </>
                  )}
                </>
              )}
              {vpVisible && periodVolumeProfile && periodVolumeProfile.totalVolume > 0 && (
                <>
                  <span className="text-[#f23645]">
                    {volumeProfileConfig.periodMode === 'prev_week' ? 'PW POC' : 'PD POC'}
                  </span>
                  <span className="text-right text-[#f23645] font-semibold">
                    {formatPrice(periodVolumeProfile.pocPrice, effectiveDecimals)}
                  </span>
                  <span className="text-[#38bdf8]">
                    {volumeProfileConfig.periodMode === 'prev_week' ? 'PW VAH / VAL' : 'PD VAH / VAL'}
                  </span>
                  <span className="text-right text-[#38bdf8]">
                    {formatPrice(periodVolumeProfile.vahPrice, effectiveDecimals)} /{' '}
                    {formatPrice(periodVolumeProfile.valPrice, effectiveDecimals)}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Bar Replay Control Bar when Replay Mode is Active */}
      {replayActive && (
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 tv-glass-popover border rounded-xl px-2.5 py-1 text-[11px] text-[var(--tv-text)]">
          <span className="text-[10.5px] font-semibold text-[var(--tv-accent)] uppercase tracking-wider mr-1">
            Bar Replay ({replayIndex}/{candles.length})
          </span>
          <button
            type="button"
            onClick={onReplayTogglePlay}
            aria-label={replayPlaying ? 'Pause Replay' : 'Play Replay'}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] font-medium"
          >
            {replayPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{replayPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={onReplayStep}
            aria-label="Step Forward One Bar"
            className="flex items-center gap-1 px-2 py-0.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)]"
          >
            <SkipForward className="w-3 h-3" />
            <span>+1 Bar</span>
          </button>
          <button
            type="button"
            onClick={onReplayExit}
            aria-label="Exit Bar Replay"
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Exit</span>
          </button>
        </div>
      )}

      {/* Bottom-Left "TradingView" Logo Watermark */}
      <div
        className={`absolute left-2.5 z-20 flex items-center gap-1 pointer-events-none transition-[bottom] ${
          favoritesBarVisible && isActivePane ? 'bottom-[44px]' : 'bottom-[30px]'
        }`}
      >
        <div className="flex items-center gap-1 font-bold text-[13px] tracking-tight text-[var(--tv-text)] opacity-85">
          <svg viewBox="0 0 28 20" className="w-5 h-3.5 fill-current">
            <path d="M0 0H11V11H6V20H0V0ZM14 20L21 0H28L21 20H14Z" />
            <circle cx="14.5" cy="4.5" r="3" />
          </svg>
          <span>TradingView</span>
        </div>
      </div>

      {/* Floating Favorite Drawing Tools Toolbar (shown on active pane) */}
      <FloatingFavoritesToolbar
        activeTool={activeTool}
        favoriteToolIds={favoriteToolIds}
        onSelectTool={onSelectTool}
        onQuickPlaceTool={handleQuickPlaceTool}
        visible={favoritesBarVisible && isActivePane}
      />

      {/* Bottom-Right Purple Lightning Bolt (Latest News & Events) + Scale Settings Gear */}
      {(chartSettings?.showEconomicEvents ?? true) && !isMultiPane && (
        <button
          type="button"
          onClick={onOpenNewsDrawer}
          aria-label="Latest Market News and Economic Events"
          title="Latest News & Economic Events on Timeline"
          className="absolute bottom-[34px] right-[82px] z-20 w-6 h-6 rounded-full border border-[#9c27b0] tv-glass-card text-[#9c27b0] flex items-center justify-center shadow-sm hover:scale-105 transition-transform cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
        </button>
      )}

      <div className="absolute bottom-[3px] right-[24px] z-30">
        <button
          type="button"
          onClick={() => setScaleSettingsOpen((v) => !v)}
          aria-label="Chart Scale Settings"
          title="Chart Scale & Display Settings"
          className="p-0.5 rounded hover:bg-[var(--tv-bg-hover)] transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
        </button>
        {scaleSettingsOpen && (
          <div className="absolute right-0 bottom-6 w-52 tv-glass-popover border rounded-xl p-1.5 text-[11px] text-[var(--tv-text-secondary)] z-50">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setScaleSettingsOpen(false);
                  onOpenSettings('scales_and_lines');
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text)] font-medium border-b border-[var(--tv-border)] mb-1 pb-2"
              >
                <span>Chart Settings...</span>
                <Settings className="w-3 h-3 text-[var(--tv-text-muted)]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onToggleAutoScale?.();
                setScaleSettingsOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--tv-bg-hover)]"
            >
              <span>Auto Scale Price Axis</span>
              <span className={autoScale ? 'text-[var(--tv-accent)] font-semibold' : 'text-[var(--tv-text-muted)]'}>
                {autoScale ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                onToggleLogScale?.();
                setScaleSettingsOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--tv-bg-hover)]"
            >
              <span>Logarithmic Scale</span>
              <span className={logScale ? 'text-[var(--tv-accent)] font-semibold' : 'text-[var(--tv-text-muted)]'}>
                {logScale ? 'ON' : 'OFF'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                chartRef.current?.timeScale().fitContent();
                setScaleSettingsOpen(false);
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-[var(--tv-bg-hover)]"
            >
              Fit All Loaded Bars
            </button>
            <button
              type="button"
              onClick={() => {
                setFloatingTooltipEnabled((v) => !v);
                setScaleSettingsOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded hover:bg-[var(--tv-bg-hover)]"
            >
              <span>Floating OHLC HUD</span>
              <span className={floatingTooltipEnabled ? 'text-[var(--tv-accent)] font-semibold' : 'text-[var(--tv-text-muted)]'}>
                {floatingTooltipEnabled ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
