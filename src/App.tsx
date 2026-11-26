/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  INITIAL_SYMBOLS,
  SymbolInfo,
  CandleBar,
  PriceAlert,
  TradePosition,
  evaluateAlertTrigger,
  parseTimeframeToSeconds,
  parseLseTimeToUnix,
  mergeTickIntoCandles,
} from './utils/marketEngine';
import {
  ChartStyleType,
  DrawingToolId,
  ChartDrawing,
  DrawingTemplate,
  IndicatorConfig,
  RightRailTab,
  CompareOverlay,
  LseUsageData,
  EconomicEventItem,
  BondYieldItem,
  TickTapeEntry,
  LseSymbolDetails,
  ChartSettingsConfig,
  getDefaultChartSettings,
  LAYOUT_PRESETS,
  LayoutSyncConfig,
  ChartPaneConfig,
  ChartGexOverlayLevel,
  GexChartOverlayConfig,
  GexDashboardData,
  VolumeProfileConfig,
  DEFAULT_VOLUME_PROFILE_CONFIG,
  AppThemeConfig,
} from './types/trading';
import {
  DEFAULT_GEX_OVERLAY_CONFIG,
  StaticProxyAnchor,
  buildChartGexLevels,
  getActiveOptionsSessionDateEt,
  projectGexDashboardAtSpot,
  resolveChartGexScaleSpot,
  resolveGexUnderlyingForSymbol,
} from './utils/gexEngine';
import {
  applyThemeCssVars,
  getPresetById,
  loadLastDarkTheme,
  loadSavedAppTheme,
  saveAppTheme,
  syncChartSettingsWithAppTheme,
} from './utils/themeEngine';
import { TopToolbar } from './components/TopToolbar';
import { LeftDrawingToolbar } from './components/LeftDrawingToolbar';
import { DEFAULT_FAVORITE_TOOLS } from './components/FloatingFavoritesToolbar';
import { ChartWorkspace } from './components/ChartWorkspace';
import { RightSidebar } from './components/RightSidebar';
import { BottomBar } from './components/BottomBar';
import {
  SymbolSearchModal,
  IndicatorsModal,
  CreateAlertModal,
  LseAccountUsageModal,
} from './components/Modals';
import { ChartSettingsModal, SettingsTabId } from './components/ChartSettingsModal';
import { GexDashboardModal } from './components/GexDashboardModal';
import { LiveWallpaperCanvas } from './components/LiveWallpaperCanvas';
import { ThemeStudioModal } from './components/ThemeStudioModal';
import { rememberDrawingToolStyle, translateDrawing } from './utils/drawingEngine';
import {
  forceSaveWorkspaceToServer,
  logOutAccount,
  queueRemoteWorkspaceSave,
  type AccountUser,
} from './services/workspaceApi';
import { AuthPage } from './components/AuthPage';
import {
  loadGuestWorkspace,
  saveGuestWorkspace,
  WorkspacePreferencesState,
} from './services/userCloudStore';

const DEFAULT_TIMEFRAMES = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '4h',
  'D',
  'W',
  'M',
  '3M',
  '12M',
];

const INITIAL_INDICATORS: IndicatorConfig[] = [
  {
    id: 'gex-levels',
    name: '0DTE Options GEX Levels (Call/Put Wall, Zero Gamma, HVL, 1D EM)',
    shortTitle: 'GEX Levels',
    paramsText: 'Call/Put Wall · Zero Gamma · 1D EM',
    visible: false,
    category: 'institutional',
    color: '#089981',
  },
  {
    id: 'iv-walls-1',
    name: 'IV WALLS [H+D+W+M+Q+Y]',
    shortTitle: 'IV WALLS[H+D+W+M+Q+Y]',
    paramsText: '5 1 2 20 1 1 5 1 1 20 1 1 5 2 2 10 2 1 5 1 2 10 2 1',
    visible: false,
    category: 'institutional',
  },
  {
    id: 'iv-walls-2',
    name: 'IV WALLS [D+W+H+4H] Institutional Sigma',
    shortTitle: 'IV WALLS[D+W+H+4H]',
    paramsText: 'Dynamic 1σ Realized Volatility Levels',
    visible: true,
    category: 'institutional',
  },
  {
    id: 'ssmt-zones',
    name: 'Quantum Wealth SSMT Liquidity Zones',
    shortTitle: 'Quantum Wealth SSMT',
    paramsText: '',
    visible: true,
    category: 'institutional',
  },
  {
    id: 'vwap',
    name: 'Session VWAP',
    shortTitle: 'VWAP Session',
    paramsText: 'hlc3',
    visible: false,
    category: 'overlay',
    color: '#ff9800',
  },
  {
    id: 'ema-20',
    name: 'EMA 20 Institutional Trend',
    shortTitle: 'EMA',
    paramsText: '20 close 0',
    visible: false,
    category: 'overlay',
    color: '#2962ff',
  },
  {
    id: 'sma-50',
    name: 'SMA 50 Trend Baseline',
    shortTitle: 'SMA',
    paramsText: '50 close 0',
    visible: false,
    category: 'overlay',
    color: '#e040fb',
  },
  {
    id: 'bb-20',
    name: 'Bollinger Bands (20, 2)',
    shortTitle: 'BB',
    paramsText: '20 2',
    visible: false,
    category: 'overlay',
    color: '#26a69a',
  },
  {
    id: 'volume',
    name: 'Volume Histogram',
    shortTitle: 'Vol',
    paramsText: '20',
    visible: false,
    category: 'volume',
  },
  {
    id: 'orderflow-delta',
    name: 'Orderflow Delta & CVD (Cumulative Volume Delta)',
    shortTitle: 'Orderflow',
    paramsText: 'Bar Δ · CVD · Buy/Sell',
    visible: false,
    category: 'volume',
    color: '#2962ff',
  },
  {
    id: 'absorption-delta',
    name: 'Absorption Delta Signals (Passive Bid/Ask Exhaustion)',
    shortTitle: 'Absorption Δ',
    paramsText: 'Passive Bid/Ask + CVD Div',
    visible: false,
    category: 'institutional',
    color: '#f59e0b',
  },
  {
    id: 'volume-profile',
    name: 'Volume Profile (Prev Day / Prev Week · VA & POC)',
    shortTitle: 'VP',
    paramsText: 'Prev Day · 70% VA · POC',
    visible: false,
    category: 'volume',
    color: '#2962ff',
  },
];

const COMPARE_COLORS = ['#ff9800', '#e040fb', '#26a69a', '#f59e0b'];
const CHART_SETTINGS_STORAGE_KEY = 'tv_lse_chart_settings_v1';

const INITIAL_PANES: ChartPaneConfig[] = [
  { id: 'pane-1', symbol: 'NASDAQ100', timeframe: '1m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-2', symbol: 'BTCUSDT', timeframe: '1m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-3', symbol: 'GOLD', timeframe: '5m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-4', symbol: 'EUR_USD', timeframe: '15m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-5', symbol: 'NVDA', timeframe: '5m', range: '5D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-6', symbol: 'SP500', timeframe: '5m', range: '1D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-7', symbol: 'DOW', timeframe: '15m', range: '5D', toDate: '', chartStyle: 'candles' },
  { id: 'pane-8', symbol: 'CRUDEOIL', timeframe: '15m', range: '5D', toDate: '', chartStyle: 'candles' },
];

interface CachedCandleEntry {
  candles: CandleBar[];
  loading: boolean;
  error: string | null;
  source: string;
}

function makeCandleCacheKey(
  symbol: string,
  timeframe: string,
  range: string,
  toDate: string,
  backAdjusted: boolean,
  ethSession: 'ETH' | 'RTH'
): string {
  return `${symbol}__${timeframe}__${range}__${toDate}__${backAdjusted ? 1 : 0}__${ethSession}`;
}

function loadInitialChartSettings(theme: 'light' | 'dark'): ChartSettingsConfig {
  const defaults = getDefaultChartSettings(theme);
  try {
    const raw = localStorage.getItem(CHART_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function mergeIndicatorsWithDefaults(
  saved: IndicatorConfig[] | undefined
): IndicatorConfig[] {
  if (!Array.isArray(saved) || saved.length === 0) return INITIAL_INDICATORS;
  const byId = new Map(saved.map((item) => [item.id, item]));
  return INITIAL_INDICATORS.map((def) => {
    const match = byId.get(def.id);
    if (!match) return def;
    const isRemoved = Boolean(match.removed);
    return {
      ...def,
      visible: isRemoved ? false : Boolean(match.visible),
      removed: isRemoved,
      paramsText: match.paramsText ?? def.paramsText,
    };
  });
}

function loadLegacyDrawingTemplates(): DrawingTemplate[] {
  try {
    const raw = localStorage.getItem('quant_drawing_templates_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DrawingTemplate[];
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export default function App({ initialUser }: { initialUser: AccountUser | null }) {
  const [accountUser] = useState<AccountUser | null>(initialUser);

  const initialGuestRef = useRef(loadGuestWorkspace());
  const guestPrefs = initialGuestRef.current?.preferences;

  const [symbols, setSymbols] = useState<SymbolInfo[]>(INITIAL_SYMBOLS);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>(() =>
    Array.isArray(guestPrefs?.watchlistSymbols) && guestPrefs.watchlistSymbols.length > 0
      ? guestPrefs.watchlistSymbols
      : ['NASDAQ100', 'DOW', 'SP500', 'GOLD', 'CRUDEOIL', 'BTCUSDT', 'NVDA', 'EUR_USD']
  );
  const [customTimeframes, setCustomTimeframes] = useState<string[]>(() =>
    Array.isArray(guestPrefs?.customTimeframes) ? guestPrefs.customTimeframes : []
  );
  const [appTheme, setAppTheme] = useState<AppThemeConfig>(() =>
    guestPrefs?.appTheme ? guestPrefs.appTheme : loadSavedAppTheme()
  );
  const [themeStudioOpen, setThemeStudioOpen] = useState<boolean>(false);
  const [chartCanvasTheme, setChartCanvasTheme] = useState<'light' | 'dark'>(() => {
    if (guestPrefs?.chartCanvasTheme === 'light' || guestPrefs?.chartCanvasTheme === 'dark') {
      return guestPrefs.chartCanvasTheme;
    }
    return loadSavedAppTheme().isLight ? 'light' : 'dark';
  });
  const [chartSettings, setChartSettings] = useState<ChartSettingsConfig>(() => {
    const initialTheme = guestPrefs?.appTheme ? guestPrefs.appTheme : loadSavedAppTheme();
    const base = guestPrefs?.chartSettings
      ? { ...getDefaultChartSettings(initialTheme.isLight ? 'light' : 'dark'), ...guestPrefs.chartSettings }
      : loadInitialChartSettings(initialTheme.isLight ? 'light' : 'dark');
    return syncChartSettingsWithAppTheme(base, initialTheme, false);
  });
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('symbol');

  useEffect(() => {
    applyThemeCssVars(appTheme);
    saveAppTheme(appTheme);
  }, [appTheme]);

  // Multi-chart layout & sync state
  const [layoutId, setLayoutId] = useState<string>(() => guestPrefs?.layoutId || '1');
  const [layoutSync, setLayoutSync] = useState<LayoutSyncConfig>(() =>
    guestPrefs?.layoutSync || {
      symbol: false,
      interval: false,
      crosshair: true,
      time: false,
      dateRange: false,
    }
  );
  const [panes, setPanes] = useState<ChartPaneConfig[]>(() =>
    Array.isArray(guestPrefs?.panes) && guestPrefs.panes.length >= 1
      ? guestPrefs.panes
      : INITIAL_PANES
  );
  const [activePaneId, setActivePaneId] = useState<string>(() => guestPrefs?.activePaneId || 'pane-1');
  const [syncedCrosshair, setSyncedCrosshair] = useState<{
    time: number;
    sourcePaneId: string;
  } | null>(null);
  const [syncedTimeRange, setSyncedTimeRange] = useState<{
    from: number;
    to: number;
    sourcePaneId: string;
  } | null>(null);

  const currentLayoutPreset =
    LAYOUT_PRESETS.find((p) => p.id === layoutId) || LAYOUT_PRESETS[0];
  const visiblePanes = panes.slice(0, currentLayoutPreset.count);
  const activePane =
    visiblePanes.find((p) => p.id === activePaneId) || visiblePanes[0] || panes[0];

  const activeSymbol = activePane.symbol;
  const activeTimeframe = activePane.timeframe;
  const activeRange = activePane.range;
  const toDate = activePane.toDate;
  const chartStyle = activePane.chartStyle;

  // Deduplicated candle cache keyed by symbol + timeframe + range + toDate + adjusted + eth
  const [candleCache, setCandleCache] = useState<Record<string, CachedCandleEntry>>({});
  const candleCacheRef = useRef<Record<string, CachedCandleEntry>>({});
  candleCacheRef.current = candleCache;
  const [candlesRetrySeq, setCandlesRetrySeq] = useState<number>(0);
  const lastRetrySeqRef = useRef<number>(0);
  const [compareOverlays, setCompareOverlays] = useState<CompareOverlay[]>([]);

  // Drawing tools & floating toolbar state
  const [activeTool, setActiveTool] = useState<DrawingToolId>('cursor');
  const [favoritesBarVisible, setFavoritesBarVisible] = useState<boolean>(
    () => guestPrefs?.favoritesBarVisible ?? true
  );
  const [favoriteToolIds, setFavoriteToolIds] = useState<DrawingToolId[]>(() =>
    Array.isArray(guestPrefs?.favoriteToolIds) && guestPrefs.favoriteToolIds.length > 0
      ? guestPrefs.favoriteToolIds
      : DEFAULT_FAVORITE_TOOLS
  );
  const [magnetActive, setMagnetActive] = useState<boolean>(() => guestPrefs?.magnetActive ?? true);
  const [stayInDrawingMode, setStayInDrawingMode] = useState<boolean>(
    () => guestPrefs?.stayInDrawingMode ?? false
  );
  const [drawingsLocked, setDrawingsLocked] = useState<boolean>(
    () => guestPrefs?.drawingsLocked ?? false
  );
  const [drawingsHidden, setDrawingsHidden] = useState<boolean>(
    () => guestPrefs?.drawingsHidden ?? false
  );
  const [drawings, setDrawings] = useState<ChartDrawing[]>(() =>
    Array.isArray(initialGuestRef.current?.drawings) ? initialGuestRef.current.drawings : []
  );
  const [drawingTemplates, setDrawingTemplates] = useState<DrawingTemplate[]>(() =>
    Array.isArray(initialGuestRef.current?.drawingTemplates)
      ? initialGuestRef.current.drawingTemplates
      : loadLegacyDrawingTemplates()
  );
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [drawingPast, setDrawingPast] = useState<ChartDrawing[][]>([]);
  const [drawingFuture, setDrawingFuture] = useState<ChartDrawing[][]>([]);
  const [zoomTrigger, setZoomTrigger] = useState<number>(0);

  // Indicators, Alerts & Positions
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() =>
    mergeIndicatorsWithDefaults(guestPrefs?.indicators)
  );
  const [volumeProfileConfig, setVolumeProfileConfig] = useState<VolumeProfileConfig>(() => ({
    ...DEFAULT_VOLUME_PROFILE_CONFIG,
    ...(guestPrefs?.volumeProfileConfig || {}),
  }));
  const [alerts, setAlerts] = useState<PriceAlert[]>(() =>
    Array.isArray(initialGuestRef.current?.alerts) ? initialGuestRef.current.alerts : []
  );
  const [positions, setPositions] = useState<TradePosition[]>(() =>
    Array.isArray(initialGuestRef.current?.positions) ? initialGuestRef.current.positions : []
  );

  // Right sidebar tab & bottom bar states
  const [rightRailTab, setRightRailTab] = useState<RightRailTab>(
    () => guestPrefs?.rightRailTab || 'watchlist'
  );
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      return false;
    }
    return guestPrefs?.rightPanelOpen ?? true;
  });
  const [ethSession, setEthSession] = useState<'ETH' | 'RTH'>(
    () => (guestPrefs?.ethSession === 'RTH' ? 'RTH' : 'ETH')
  );
  const [backAdjusted, setBackAdjusted] = useState<boolean>(() => guestPrefs?.backAdjusted ?? true);
  const [logScale, setLogScale] = useState<boolean>(() => guestPrefs?.logScale ?? false);
  const [autoScale, setAutoScale] = useState<boolean>(() => guestPrefs?.autoScale ?? true);
  const [timezoneId, setTimezoneId] = useState<string>(
    () => guestPrefs?.timezoneId || 'America/New_York'
  );

  // LSE Reference, Macro, Usage & Live Tape data
  const [economicEvents, setEconomicEvents] = useState<EconomicEventItem[]>([]);
  const [bondYields, setBondYields] = useState<BondYieldItem[]>([]);
  const [symbolDetails, setSymbolDetails] = useState<LseSymbolDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [tickTape, setTickTape] = useState<TickTapeEntry[]>([]);
  const [lseUsage, setLseUsage] = useState<LseUsageData | null>(null);
  const [loadingUsage, setLoadingUsage] = useState<boolean>(false);

  // Bar Replay state
  const [replayActive, setReplayActive] = useState<boolean>(false);
  const [replayIndex, setReplayIndex] = useState<number>(120);
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);

  // Modals state
  const [symbolModalOpen, setSymbolModalOpen] = useState<boolean>(false);
  const [symbolModalMode, setSymbolModalMode] = useState<'switch' | 'compare' | 'watchlist'>('switch');
  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState<boolean>(false);
  const [alertModalOpen, setAlertModalOpen] = useState<boolean>(false);
  const [usageModalOpen, setUsageModalOpen] = useState<boolean>(false);
  const [gexModalOpen, setGexModalOpen] = useState<boolean>(false);
  const [gexUnderlying, setGexUnderlying] = useState<string>('SPY');
  const [gexOverlayLevels, setGexOverlayLevels] = useState<ChartGexOverlayLevel[]>([]);
  const [gexOverlayConfig, setGexOverlayConfig] = useState<GexChartOverlayConfig>(() => ({
    ...DEFAULT_GEX_OVERLAY_CONFIG,
    ...(guestPrefs?.gexOverlayConfig || {}),
  }));
  const [syncToast, setSyncToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [gexDataCache, setGexDataCache] = useState<
    Record<string, { data: GexDashboardData | null; loading: boolean; error: string | null }>
  >({});
  const gexDataCacheRef = useRef(gexDataCache);
  gexDataCacheRef.current = gexDataCache;
  const [gexRetrySeq, setGexRetrySeq] = useState<number>(0);
  const lastGexRetrySeqRef = useRef<number>(0);
  const staticProxyAnchorRef = useRef<Record<string, StaticProxyAnchor>>({});

  // Real-time WebSocket & HTTP Live Fallback status
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  // Deployments without a persistent server (Cloudflare Workers) report ws:false and
  // rely purely on the HTTP polling fallback.
  const [wsSupported, setWsSupported] = useState<boolean>(true);
  const [httpLiveActive, setHttpLiveActive] = useState<boolean>(false);
  const [liveStreamEnabled, setLiveStreamEnabled] = useState<boolean>(true);
  const [lastTickSymbol, setLastTickSymbol] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastTickReceivedAtRef = useRef<number>(0);
  const lastTickSeqRef = useRef<number>(0);
  const symbolsRef = useRef(symbols);
  symbolsRef.current = symbols;
  const activePaneRef = useRef(activePane);
  activePaneRef.current = activePane;

  const activeSymbolObj = symbols.find((s) => s.symbol === activeSymbol) || symbols[0];

  const activeCacheKey = makeCandleCacheKey(
    activeSymbol,
    activeTimeframe,
    activeRange,
    toDate,
    backAdjusted,
    ethSession
  );
  const activeCacheEntry = candleCache[activeCacheKey];
  const candles = activeCacheEntry?.candles ?? [];
  const loadingCandles = activeCacheEntry ? activeCacheEntry.loading : true;
  const candlesError = activeCacheEntry?.error ?? null;

  const setActiveSymbol = useCallback(
    (nextSymbol: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.symbol ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, symbol: nextSymbol };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.symbol]
  );

  const setActiveTimeframe = useCallback(
    (nextTimeframe: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.interval ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, timeframe: nextTimeframe };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.interval]
  );

  const setActiveRangeAndDate = useCallback(
    (nextRange: string, nextToDate?: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.dateRange ? visibleIds.has(p.id) : p.id === activePane.id) {
            return {
              ...p,
              range: nextRange,
              toDate: nextToDate !== undefined ? nextToDate : p.toDate,
            };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.dateRange]
  );

  const setToDate = useCallback(
    (nextToDate: string) => {
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, currentLayoutPreset.count).map((p) => p.id));
        return prev.map((p) => {
          if (layoutSync.dateRange ? visibleIds.has(p.id) : p.id === activePane.id) {
            return { ...p, toDate: nextToDate };
          }
          return p;
        });
      });
    },
    [activePane.id, currentLayoutPreset.count, layoutSync.dateRange]
  );

  const setChartStyle = useCallback(
    (nextStyle: ChartStyleType) => {
      setPanes((prev) =>
        prev.map((p) => (p.id === activePane.id ? { ...p, chartStyle: nextStyle } : p))
      );
    },
    [activePane.id]
  );

  const handleSelectLayout = useCallback(
    (nextLayoutId: string) => {
      const preset = LAYOUT_PRESETS.find((p) => p.id === nextLayoutId) || LAYOUT_PRESETS[0];
      setLayoutId(preset.id);
      setPanes((prev) => {
        const visibleIds = new Set(prev.slice(0, preset.count).map((p) => p.id));
        if (!visibleIds.has(activePane.id)) {
          setActivePaneId(prev[0].id);
        }
        if (!layoutSync.symbol && !layoutSync.interval && !layoutSync.dateRange) {
          return prev;
        }
        return prev.map((p) => {
          if (!visibleIds.has(p.id)) return p;
          return {
            ...p,
            symbol: layoutSync.symbol ? activePane.symbol : p.symbol,
            timeframe: layoutSync.interval ? activePane.timeframe : p.timeframe,
            range: layoutSync.dateRange ? activePane.range : p.range,
            toDate: layoutSync.dateRange ? activePane.toDate : p.toDate,
          };
        });
      });
    },
    [activePane, layoutSync]
  );

  const handleToggleLayoutSync = useCallback(
    (key: keyof LayoutSyncConfig) => {
      setLayoutSync((prev) => {
        const nextVal = !prev[key];
        const next = { ...prev, [key]: nextVal };
        if (nextVal && (key === 'symbol' || key === 'interval' || key === 'dateRange')) {
          setPanes((currPanes) => {
            const visibleIds = new Set(
              currPanes.slice(0, currentLayoutPreset.count).map((p) => p.id)
            );
            return currPanes.map((p) => {
              if (!visibleIds.has(p.id)) return p;
              return {
                ...p,
                symbol: key === 'symbol' ? activePane.symbol : p.symbol,
                timeframe: key === 'interval' ? activePane.timeframe : p.timeframe,
                range: key === 'dateRange' ? activePane.range : p.range,
                toDate: key === 'dateRange' ? activePane.toDate : p.toDate,
              };
            });
          });
        }
        return next;
      });
    },
    [activePane, currentLayoutPreset.count]
  );

  const handleUpdateAppTheme = useCallback(
    (nextTheme: AppThemeConfig, forceChartColors = false) => {
      setAppTheme(nextTheme);
      const nextCanvasTheme: 'light' | 'dark' = nextTheme.isLight ? 'light' : 'dark';
      setChartCanvasTheme(nextCanvasTheme);
      setChartSettings((prevSettings) => {
        const synced = syncChartSettingsWithAppTheme(
          prevSettings,
          nextTheme,
          forceChartColors
        );
        try {
          localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(synced));
        } catch {
          // ignore
        }
        return synced;
      });
    },
    []
  );

  const handleToggleChartCanvasTheme = useCallback(() => {
    const nextTheme = appTheme.isLight ? loadLastDarkTheme() : getPresetById('arctic-daylight');
    handleUpdateAppTheme(nextTheme, false);
  }, [appTheme.isLight, handleUpdateAppTheme]);

  // Hydrate initial LSE market snapshot + Economic Calendar on mount
  useEffect(() => {
    fetch('/api/market/snapshot')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.symbols)) {
          setSymbols(data.symbols);
        }
      })
      .catch(() => {});

    fetch('/api/lse/calendar?limit=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rows)) {
          setEconomicEvents(data.rows);
        }
      })
      .catch(() => {
        // Keep empty gracefully if offline
      });
  }, []);

  // Fetch Sovereign Bond Yields lazily when Macro tab is opened
  useEffect(() => {
    if (rightRailTab !== 'macro_yields' || bondYields.length > 0) return;
    fetch('/api/lse/bond-yields?limit=30')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.rows)) {
          setBondYields(data.rows);
        }
      })
      .catch(() => {});
  }, [rightRailTab, bondYields.length]);

  // Fetch Symbol Fundamentals/Details when Fundamentals tab opens or activeSymbol changes while tab is open
  useEffect(() => {
    if (rightRailTab !== 'screener_factors') return;
    let cancelled = false;
    setLoadingDetails(true);
    const qs = new URLSearchParams({
      symbol: activeSymbolObj.symbol,
      market: activeSymbolObj.lseMarket,
      httpSymbol: activeSymbolObj.lseHttpSymbol,
    });
    fetch(`/api/lse/details?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setSymbolDetails(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetails(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rightRailTab, activeSymbolObj.symbol, activeSymbolObj.lseMarket, activeSymbolObj.lseHttpSymbol]);

  const fetchLseUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch('/api/lse/usage');
      if (res.ok) {
        const data = await res.json();
        setLseUsage(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    if (usageModalOpen) {
      fetchLseUsage();
    }
  }, [usageModalOpen, fetchLseUsage]);

  const [currentEtDate, setCurrentEtDate] = useState<string>(() => getActiveOptionsSessionDateEt());
  const [liveTickDeltas, setLiveTickDeltas] = useState<Record<string, Record<number, number>>>({});
  const lastWsPriceBySymRef = useRef<Record<string, number>>({});

  // Advance active options session date automatically across 16:15 ET / weekends / calendar rollovers
  useEffect(() => {
    const dayTimer = setInterval(() => {
      const nextEt = getActiveOptionsSessionDateEt();
      setCurrentEtDate((prev) => {
        if (prev !== nextEt) {
          setGexOverlayConfig((cfg) =>
            cfg.expiryMode &&
            /^\d{4}-\d{2}-\d{2}$/.test(cfg.expiryMode) &&
            cfg.expiryMode < nextEt
              ? { ...cfg, expiryMode: '0dte' }
              : cfg
          );
          setGexRetrySeq((c) => c + 1);
          return nextEt;
        }
        return prev;
      });
    }, 30_000);
    return () => clearInterval(dayTimer);
  }, []);

  const gexIndicatorVisible = indicators.some((i) => i.id === 'gex-levels' && i.visible);

  // Periodically refresh active OPRA GEX chain/flow every 30s only when live Dynamic Spot Tracking is explicitly enabled
  useEffect(() => {
    if (!gexIndicatorVisible || !gexOverlayConfig.dynamicSpotTracking) return;
    const poll = setInterval(() => {
      setGexRetrySeq((c) => c + 1);
    }, 30_000);
    return () => clearInterval(poll);
  }, [gexIndicatorVisible, gexOverlayConfig.dynamicSpotTracking]);

  const visibleGexUnderlyingsSig = visiblePanes
    .map((p) => {
      const sm = symbols.find((s) => s.symbol === p.symbol) || symbols[0];
      const res = resolveGexUnderlyingForSymbol(
        sm?.symbol || p.symbol,
        sm?.lseMarket || '',
        sm?.lseHttpSymbol || p.symbol,
        gexOverlayConfig.futuresProxyEnabled
      );
      return res ? res.underlying : '';
    })
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .sort()
    .join(',');

  // Auto-fetch live OPRA GEX levels whenever the on-chart GEX Levels indicator is enabled
  useEffect(() => {
    if (!gexIndicatorVisible || !visibleGexUnderlyingsSig) return;
    const controller = new AbortController();
    const forceRefresh = gexRetrySeq !== lastGexRetrySeqRef.current;
    lastGexRetrySeqRef.current = gexRetrySeq;

    const expiryMode = gexOverlayConfig.expiryMode || '0dte';
    const isExplicitDate = /^\d{4}-\d{2}-\d{2}$/.test(expiryMode);
    const underlyings = visibleGexUnderlyingsSig.split(',').filter(Boolean);

    for (const u of underlyings) {
      const cacheKey = `${u}__${expiryMode}__${currentEtDate}`;
      const existing = gexDataCacheRef.current[cacheKey];
      if (!forceRefresh && existing && (existing.loading || (existing.data && !existing.error))) {
        continue;
      }

      setGexDataCache((prev) => ({
        ...prev,
        [cacheKey]: {
          data: prev[cacheKey]?.data ?? null,
          loading: true,
          error: null,
        },
      }));

      const qs = new URLSearchParams({
        underlying: u,
        flow_scope: '0dte',
      });
      if (isExplicitDate) {
        qs.set('expiry', expiryMode);
        qs.set('horizon', 'custom');
      } else {
        qs.set('horizon', expiryMode);
      }

      fetch(`/api/lse/options/gex?${qs.toString()}`, { signal: controller.signal })
        .then(async (r) => {
          const payload = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(payload.error || `GEX lookup failed for ${u}`);
          }
          return payload as GexDashboardData;
        })
        .then((payload) => {
          if (controller.signal.aborted) return;
          setGexDataCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: payload,
              loading: false,
              error: null,
            },
          }));
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return;
          setGexDataCache((prev) => ({
            ...prev,
            [cacheKey]: {
              data: prev[cacheKey]?.data ?? null,
              loading: false,
              error: (err as Error).message || `Failed to load GEX levels for ${u}`,
            },
          }));
        });
    }

    return () => controller.abort();
  }, [gexIndicatorVisible, visibleGexUnderlyingsSig, gexOverlayConfig.expiryMode, currentEtDate, gexRetrySeq]);

  const visiblePaneSpecsSig = visiblePanes
    .map((p) =>
      makeCandleCacheKey(p.symbol, p.timeframe, p.range, p.toDate, backAdjusted, ethSession)
    )
    .join('|');

  // Fetch real OHLCV candles from LSE Data 3.0 backend proxy for all unique visible panes
  useEffect(() => {
    const controller = new AbortController();
    const forceRetry = candlesRetrySeq !== lastRetrySeqRef.current;
    lastRetrySeqRef.current = candlesRetrySeq;

    const seenKeys = new Set<string>();
    const toFetch: Array<{
      cacheKey: string;
      symbol: string;
      timeframe: string;
      range: string;
      toDate: string;
    }> = [];

    for (const pane of visiblePanes) {
      const cacheKey = makeCandleCacheKey(
        pane.symbol,
        pane.timeframe,
        pane.range,
        pane.toDate,
        backAdjusted,
        ethSession
      );
      if (seenKeys.has(cacheKey)) continue;
      seenKeys.add(cacheKey);
      const existing = candleCacheRef.current[cacheKey];
      if (!forceRetry && existing && !existing.error && existing.candles.length > 0 && !existing.loading) {
        continue;
      }
      toFetch.push({
        cacheKey,
        symbol: pane.symbol,
        timeframe: pane.timeframe,
        range: pane.range,
        toDate: pane.toDate,
      });
    }

    if (toFetch.length === 0) return () => controller.abort();

    setCandleCache((prev) => {
      const next = { ...prev };
      for (const item of toFetch) {
        next[item.cacheKey] = {
          candles: prev[item.cacheKey]?.candles ?? [],
          loading: true,
          error: null,
          source: prev[item.cacheKey]?.source ?? 'lse-export',
        };
      }
      return next;
    });

    for (const item of toFetch) {
      const symMeta =
        symbolsRef.current.find((s) => s.symbol === item.symbol) || symbolsRef.current[0];
      const qs = new URLSearchParams({
        symbol: symMeta?.symbol || item.symbol,
        market: symMeta?.lseMarket || '',
        httpSymbol: symMeta?.lseHttpSymbol || item.symbol,
        timeframe: item.timeframe,
        range: item.range,
        adjusted: backAdjusted ? '1' : '0',
        eth: ethSession,
      });
      if (item.toDate) qs.set('toDate', item.toDate);

      fetch(`/api/market/candles?${qs.toString()}`, { signal: controller.signal })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(data.error || 'LSE candle request failed');
          }
          return data;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          if (Array.isArray(data.candles)) {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: data.candles,
                loading: false,
                error: null,
                source: data.source || 'lse-export',
              },
            }));
            const curActiveKey = makeCandleCacheKey(
              activePaneRef.current.symbol,
              activePaneRef.current.timeframe,
              activePaneRef.current.range,
              activePaneRef.current.toDate,
              backAdjusted,
              ethSession
            );
            if (item.cacheKey === curActiveKey) {
              setReplayIndex(Math.max(20, data.candles.length - 20));
            }
          } else {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: [],
                loading: false,
                error: 'No candle array returned by LSE API',
                source: 'lse-export',
              },
            }));
          }
        })
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') {
            setCandleCache((prev) => ({
              ...prev,
              [item.cacheKey]: {
                candles: [],
                loading: false,
                error: (err as Error).message || 'Failed to load LSE candles',
                source: 'lse-export',
              },
            }));
          }
        });
    }

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePaneSpecsSig, backAdjusted, ethSession, candlesRetrySeq]);

  // Shared tick ingestion pipeline used by BOTH WebSocket and HTTP live fallback
  const applyIncomingTick = useCallback(
    (
      incoming: SymbolInfo,
      rawTick?: {
        price: number;
        bid: number;
        ask: number;
        volume?: number;
        ts?: string;
        sourceSocket?: string;
      },
      seq?: number
    ) => {
      if (typeof seq === 'number' && seq > lastTickSeqRef.current) {
        lastTickSeqRef.current = seq;
      }
      lastTickReceivedAtRef.current = Date.now();
      setLastTickSymbol(incoming.symbol);

      if (rawTick) {
        setTickTape((prev) => [
          {
            id: `${seq || Date.now()}-${incoming.symbol}-${Math.random().toString(36).slice(2, 5)}`,
            symbol: incoming.symbol,
            price: rawTick.price,
            bid: rawTick.bid,
            ask: rawTick.ask,
            volume: rawTick.volume || 0,
            ts: rawTick.ts || new Date().toISOString(),
            sourceSocket: rawTick.sourceSocket,
          },
          ...prev.slice(0, 79),
        ]);
      }

      setSymbols((prev) => {
        const oldSym = prev.find((s) => s.symbol === incoming.symbol);
        if (oldSym) {
          setAlerts((prevAlerts) =>
            prevAlerts.map((al) => {
              if (
                al.symbol === incoming.symbol &&
                evaluateAlertTrigger(al, oldSym.price, incoming.price)
              ) {
                return {
                  ...al,
                  triggered: true,
                  triggeredAt: new Date().toLocaleTimeString(),
                };
              }
              return al;
            })
          );
        }
        const exists = prev.some((s) => s.symbol === incoming.symbol);
        return exists
          ? prev.map((s) => (s.symbol === incoming.symbol ? incoming : s))
          : [...prev, incoming];
      });

      // Live tick candle aggregation & tick-signed orderflow delta across cached symbol/timeframe entries
      const tickSec = parseLseTimeToUnix(rawTick?.ts || Date.now());
      const tickVol = Number(rawTick?.volume) || 0;
      const prevPx = lastWsPriceBySymRef.current[incoming.symbol];
      const tickDir =
        prevPx === undefined
          ? incoming.price >= incoming.dayOpen
            ? 1
            : -1
          : incoming.price > prevPx
          ? 1
          : incoming.price < prevPx
          ? -1
          : 0;
      lastWsPriceBySymRef.current[incoming.symbol] = incoming.price;
      const symPrefix = `${incoming.symbol}__`;

      if (tickVol > 0 && tickDir !== 0) {
        setLiveTickDeltas((prevDeltas) => {
          let mutatedD = false;
          let nextDeltas = prevDeltas;
          const cacheKeys = Object.keys(candleCacheRef.current);
          for (const key of cacheKeys) {
            if (!key.startsWith(symPrefix)) continue;
            const tf = key.split('__')[1] || '1m';
            const tfSec = parseTimeframeToSeconds(tf);
            const bucketSec = Math.floor(tickSec / Math.max(1, tfSec)) * Math.max(1, tfSec);
            if (!mutatedD) {
              nextDeltas = { ...prevDeltas };
              mutatedD = true;
            }
            const curMap = nextDeltas[key] ? { ...nextDeltas[key] } : {};
            curMap[bucketSec] = (curMap[bucketSec] || 0) + tickDir * tickVol;
            nextDeltas[key] = curMap;
          }
          return nextDeltas;
        });
      }

      setCandleCache((prevCache) => {
        let mutated = false;
        let nextCache = prevCache;
        for (const [key, entry] of Object.entries(prevCache)) {
          if (!key.startsWith(symPrefix) || entry.candles.length === 0) continue;
          const tf = key.split('__')[1] || '1m';
          const tfSec = parseTimeframeToSeconds(tf);
          const updatedCandles = mergeTickIntoCandles(
            entry.candles,
            incoming.price,
            tickSec,
            tickVol,
            tfSec
          );
          if (updatedCandles !== entry.candles) {
            if (!mutated) {
              nextCache = { ...prevCache };
              mutated = true;
            }
            nextCache[key] = { ...entry, candles: updatedCandles };
          }
        }
        return nextCache;
      });
    },
    []
  );

  const visibleSymbolsSig = visiblePanes
    .map((p) => p.symbol)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(',');
  const visibleSymbolsSigRef = useRef<string>(visibleSymbolsSig);
  visibleSymbolsSigRef.current = visibleSymbolsSig;

  // Ask the backend whether it offers the streaming socket at all
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data && data.ws === false) setWsSupported(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Connect to Real-Time WebSocket Market Feed (/ws/market) with ping keep-alive
  useEffect(() => {
    if (!wsSupported) {
      setWsConnected(false);
      return;
    }
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let isUnmounted = false;

    const connectWs = () => {
      if (isUnmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/market`;
      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch {
        reconnectTimer = setTimeout(connectWs, 3500);
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmounted) return;
        setWsConnected(true);
        const syms = visibleSymbolsSigRef.current.split(',').filter(Boolean);
        if (syms.length > 0) {
          try {
            socket.send(JSON.stringify({ type: 'client:active_symbols', symbols: syms }));
          } catch {
            // ignore
          }
        }
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'market:init' && Array.isArray(msg.symbols)) {
            setSymbols(msg.symbols);
            if (typeof msg.seq === 'number' && msg.seq > lastTickSeqRef.current) {
              lastTickSeqRef.current = msg.seq;
            }
            if (typeof msg.liveStreamEnabled === 'boolean') {
              setLiveStreamEnabled(msg.liveStreamEnabled);
            }
          } else if (msg.type === 'symbol:added' && msg.symbol) {
            setSymbols((prev) => {
              const exists = prev.some((s) => s.symbol === msg.symbol.symbol);
              return exists
                ? prev.map((s) => (s.symbol === msg.symbol.symbol ? msg.symbol : s))
                : [...prev, msg.symbol];
            });
          } else if (msg.type === 'feed:status') {
            setLiveStreamEnabled(Boolean(msg.liveStreamEnabled));
          } else if (msg.type === 'market:tick' && msg.tick) {
            applyIncomingTick(msg.tick as SymbolInfo, msg.rawTick, msg.seq);
          }
        } catch {
          // Ignore parse errors
        }
      };

      socket.onerror = () => {
        try {
          socket.close();
        } catch {
          // ignore
        }
      };

      socket.onclose = () => {
        if (!isUnmounted) {
          setWsConnected(false);
          reconnectTimer = setTimeout(connectWs, 3000);
        }
      };
    };

    connectWs();

    pingTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore
        }
      }
    }, 25_000);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [applyIncomingTick, wsSupported]);

  // Inform backend whenever the visible chart symbols change
  useEffect(() => {
    const syms = visibleSymbolsSig.split(',').filter(Boolean);
    if (syms.length > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'client:active_symbols', symbols: syms }));
      } catch {
        // ignore
      }
    }
  }, [visibleSymbolsSig, wsConnected]);

  // Automatic Live HTTP Fallback Poller (guarantees live prices & candles on Published Cloud Run sites
  // even when a proxy drops WebSockets or Preview holds the single LSE WS connection slot)
  useEffect(() => {
    if (!liveStreamEnabled) {
      setHttpLiveActive(false);
      return;
    }

    let cancelled = false;
    const pollLive = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const msSinceLastTick = Date.now() - lastTickReceivedAtRef.current;
      // Skip HTTP fallback when WebSocket is actively streaming fresh ticks
      if (wsConnected && msSinceLastTick < 5_500) {
        return;
      }

      try {
        const qs = new URLSearchParams({
          symbols: visibleSymbolsSigRef.current || 'NASDAQ100',
          since: String(lastTickSeqRef.current || 0),
        });
        const res = await fetch(`/api/market/live?${qs.toString()}`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setHttpLiveActive(true);

        if (Array.isArray(data.ticks) && data.ticks.length > 0) {
          for (const item of data.ticks) {
            if (item && item.tick && (!item.seq || item.seq > lastTickSeqRef.current)) {
              applyIncomingTick(item.tick as SymbolInfo, item.rawTick, item.seq);
            }
          }
        }
        if (Array.isArray(data.symbols) && data.symbols.length > 0) {
          setSymbols(data.symbols);
          // Also merge active visible symbol prices into live candles if price changed
          const visibleSet = new Set(visibleSymbolsSigRef.current.split(',').filter(Boolean));
          for (const sym of data.symbols as SymbolInfo[]) {
            if (visibleSet.has(sym.symbol) && sym.price > 0) {
              const prevPx = lastWsPriceBySymRef.current[sym.symbol];
              if (prevPx === undefined || prevPx !== sym.price) {
                applyIncomingTick(
                  sym,
                  {
                    price: sym.price,
                    bid: sym.bid,
                    ask: sym.ask,
                    volume: 0,
                    ts: sym.lastTickTs || new Date().toISOString(),
                    sourceSocket: 'lse-rest',
                  },
                  data.seq
                );
              }
            }
          }
        }
        if (typeof data.seq === 'number' && data.seq > lastTickSeqRef.current) {
          lastTickSeqRef.current = data.seq;
        }
      } catch {
        if (!cancelled) setHttpLiveActive(false);
      }
    };

    // Poll fast: the worker serves 1s vault candles, so a 1s client interval is the tightest
    // cadence REST polling can reach without multiplying upstream LSE calls.
    const initialTimer = setTimeout(pollLive, 150);
    const interval = setInterval(pollLive, 1_000);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [liveStreamEnabled, wsConnected, applyIncomingTick, visibleSymbolsSig]);

  // Bar Replay auto-advance timer
  useEffect(() => {
    if (!replayActive || !replayPlaying) return;
    const timer = setInterval(() => {
      setReplayIndex((idx) => {
        if (idx >= candles.length) {
          setReplayPlaying(false);
          return candles.length;
        }
        return idx + 1;
      });
    }, 650);
    return () => clearInterval(timer);
  }, [replayActive, replayPlaying, candles.length]);

  const handleToggleLiveStream = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'feed:toggle',
          enabled: !liveStreamEnabled,
        })
      );
    } else {
      setLiveStreamEnabled((v) => !v);
    }
  }, [liveStreamEnabled]);

  const handleRefreshQuotes = useCallback(async () => {
    try {
      const res = await fetch('/api/market/refresh', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.symbols)) setSymbols(data.symbols);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSelectLsePair = useCallback(
    async (
      market: string,
      pairSymbol: string,
      pairName: string,
      intent: 'switch' | 'compare' | 'watchlist'
    ) => {
      const res = await fetch('/api/market/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, symbol: pairSymbol, name: pairName }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const addedSym: SymbolInfo = data.symbol;
      if (!addedSym) return;

      setSymbols((prev) => {
        const exists = prev.some((s) => s.symbol === addedSym.symbol);
        return exists
          ? prev.map((s) => (s.symbol === addedSym.symbol ? addedSym : s))
          : [...prev, addedSym];
      });

      if (intent === 'watchlist') {
        setWatchlistSymbols((prev) =>
          prev.includes(addedSym.symbol) ? prev : [...prev, addedSym.symbol]
        );
      } else if (intent === 'compare') {
        const qs = new URLSearchParams({
          symbol: addedSym.symbol,
          market: addedSym.lseMarket,
          httpSymbol: addedSym.lseHttpSymbol,
          timeframe: activeTimeframe,
          range: activeRange,
        });
        const candleRes = await fetch(`/api/market/candles?${qs.toString()}`);
        if (candleRes.ok) {
          const candleData = await candleRes.json();
          const seriesPts = (candleData.candles || []).map((c: CandleBar) => ({
            time: c.time,
            close: c.close,
          }));
          setCompareOverlays((prev) => {
            const without = prev.filter((o) => o.symbol !== addedSym.symbol);
            const color = COMPARE_COLORS[without.length % COMPARE_COLORS.length];
            return [
              ...without,
              {
                symbol: addedSym.symbol,
                name: addedSym.name,
                color,
                market: addedSym.lseMarket,
                httpSymbol: addedSym.lseHttpSymbol,
                candles: seriesPts,
              },
            ];
          });
        }
      } else {
        setWatchlistSymbols((prev) =>
          prev.includes(addedSym.symbol) ? prev : [addedSym.symbol, ...prev]
        );
        setActiveSymbol(addedSym.symbol);
      }
    },
    [activeTimeframe, activeRange, setActiveSymbol]
  );

  const handleOpenOptionContract = useCallback(
    async (contract: {
      occSymbol: string;
      underlying: string;
      strike: number;
      expiry: string;
      contract_type: 'call' | 'put';
    }) => {
      const label = `${contract.underlying} ${contract.expiry} $${contract.strike}${
        contract.contract_type === 'call' ? 'C' : 'P'
      }`;
      await handleSelectLsePair('us_options', contract.occSymbol, label, 'switch');
    },
    [handleSelectLsePair]
  );

  const handleOpenGexDashboard = useCallback(
    (preferredUnderlying?: string) => {
      const resolved = resolveGexUnderlyingForSymbol(
        activeSymbolObj.symbol,
        activeSymbolObj.lseMarket,
        activeSymbolObj.lseHttpSymbol,
        true
      );
      const nextTicker =
        preferredUnderlying?.trim().toUpperCase() || resolved?.underlying || 'SPY';
      setGexUnderlying(nextTicker);
      setGexModalOpen(true);
    },
    [activeSymbolObj.symbol, activeSymbolObj.lseMarket, activeSymbolObj.lseHttpSymbol]
  );

  const handleTogglePinGexLevels = useCallback(
    async (
      targetUnderlying: string,
      levels: ChartGexOverlayLevel[],
      freshData?: GexDashboardData,
      horizonOrExpiry?: string
    ) => {
      const upper = targetUnderlying.toUpperCase();
      const nextMode = horizonOrExpiry || gexOverlayConfig.expiryMode || '0dte';
      const currentlyPinned =
        (gexOverlayLevels.length > 0 &&
          gexOverlayLevels[0].underlying.toUpperCase() === upper) ||
        (gexIndicatorVisible &&
          (activeSymbolObj.symbol.toUpperCase() === upper ||
            activeSymbolObj.lseHttpSymbol.toUpperCase() === upper));
      if (currentlyPinned && (!horizonOrExpiry || horizonOrExpiry === (gexOverlayConfig.expiryMode || '0dte'))) {
        setGexOverlayLevels([]);
        setIndicators((prev) =>
          prev.map((ind) => (ind.id === 'gex-levels' ? { ...ind, visible: false } : ind))
        );
        return;
      }
      if (horizonOrExpiry && horizonOrExpiry !== gexOverlayConfig.expiryMode) {
        setGexOverlayConfig((cfg) => ({ ...cfg, expiryMode: nextMode }));
      }
      if (freshData) {
        const cacheKey = `${upper}__${nextMode}__${currentEtDate}`;
        setGexDataCache((prev) => ({
          ...prev,
          [cacheKey]: { data: freshData, loading: false, error: null },
        }));
      }
      setGexOverlayLevels(levels);
      setIndicators((prev) =>
        prev.map((ind) => (ind.id === 'gex-levels' ? { ...ind, visible: true } : ind))
      );
      if (
        activeSymbolObj.symbol.toUpperCase() !== upper &&
        activeSymbolObj.lseHttpSymbol.toUpperCase() !== upper
      ) {
        const existing = symbolsRef.current.find(
          (s) => s.symbol.toUpperCase() === upper || s.lseHttpSymbol.toUpperCase() === upper
        );
        if (existing) {
          setActiveSymbol(existing.symbol);
        } else {
          await handleSelectLsePair('us_stocks', upper, upper, 'switch');
        }
      }
    },
    [
      gexOverlayLevels,
      gexIndicatorVisible,
      gexOverlayConfig.expiryMode,
      currentEtDate,
      activeSymbolObj.symbol,
      activeSymbolObj.lseHttpSymbol,
      setActiveSymbol,
      handleSelectLsePair,
    ]
  );

  const handleQuickOrder = useCallback(
    (side: 'BUY' | 'SELL', qty: number = 1, stopLoss?: number, takeProfit?: number) => {
      const fallbackLast = candles[candles.length - 1]?.close ?? 0;
      const execPrice =
        side === 'BUY'
          ? activeSymbolObj.ask > 0
            ? activeSymbolObj.ask
            : fallbackLast
          : activeSymbolObj.bid > 0
          ? activeSymbolObj.bid
          : fallbackLast;
      if (execPrice <= 0) return;
      const newPos: TradePosition = {
        id: `pos-${Date.now()}`,
        symbol: activeSymbolObj.symbol,
        side,
        qty,
        entryPrice: execPrice,
        stopLoss,
        takeProfit,
        timestamp: new Date().toLocaleTimeString(),
      };
      setPositions((prev) => [newPos, ...prev]);
    },
    [activeSymbolObj, candles]
  );

  const handleToggleSymbolFlag = useCallback((symbolKey: string) => {
    const cycle: Array<SymbolInfo['flagColor']> = ['red', 'orange', 'blue', null];
    setSymbols((prev) =>
      prev.map((s) => {
        if (s.symbol !== symbolKey) return s;
        const nextIdx = (cycle.indexOf(s.flagColor ?? null) + 1) % cycle.length;
        return { ...s, flagColor: cycle[nextIdx] };
      })
    );
  }, []);

  const handleAddCustomTimeframe = useCallback((tf: string) => {
    if (DEFAULT_TIMEFRAMES.includes(tf)) return;
    setCustomTimeframes((prev) => (prev.includes(tf) ? prev : [...prev, tf]));
  }, []);

  const handleRemoveCustomTimeframe = useCallback(
    (tf: string) => {
      setCustomTimeframes((prev) => prev.filter((item) => item !== tf));
      if (activeTimeframe === tf) {
        setActiveTimeframe('1m');
      }
    },
    [activeTimeframe]
  );

  // Drawing CRUD + Undo/Redo history helpers
  const commitDrawingsChange = useCallback(
    (updater: (prev: ChartDrawing[]) => ChartDrawing[]) => {
      setDrawings((prev) => {
        const next = updater(prev);
        setDrawingPast((past) => [...past.slice(-39), prev]);
        setDrawingFuture([]);
        return next;
      });
    },
    []
  );

  const handleAddDrawing = useCallback(
    (d: ChartDrawing) => {
      commitDrawingsChange((prev) => [...prev, d]);
    },
    [commitDrawingsChange]
  );

  const handleUpdateDrawing = useCallback(
    (updated: ChartDrawing) => {
      // Remember the style (never the text) so the next drawing with this tool reuses it
      rememberDrawingToolStyle(updated);
      commitDrawingsChange((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    },
    [commitDrawingsChange]
  );

  // Page older history in when a chart is scrolled to its oldest loaded bar
  const historyPagingRef = useRef<Record<string, { loading: boolean; exhausted: boolean }>>({});

  const handleLoadOlderCandles = useCallback(
    (pane: { symbol: string; timeframe: string; range: string; toDate: string }) => {
      const key = makeCandleCacheKey(
        pane.symbol,
        pane.timeframe,
        pane.range,
        pane.toDate,
        backAdjusted,
        ethSession
      );
      const entry = candleCacheRef.current[key];
      if (!entry || entry.loading || entry.candles.length === 0) return;

      const paging =
        historyPagingRef.current[key] ?? (historyPagingRef.current[key] = { loading: false, exhausted: false });
      if (paging.loading || paging.exhausted) return;
      paging.loading = true;

      const oldestTime = entry.candles[0].time;
      const toDate = new Date((oldestTime - 86400) * 1000).toISOString().slice(0, 10);
      const symMeta =
        symbolsRef.current.find((s) => s.symbol === pane.symbol) || symbolsRef.current[0];
      const qs = new URLSearchParams({
        symbol: symMeta?.symbol || pane.symbol,
        market: symMeta?.lseMarket || '',
        httpSymbol: symMeta?.lseHttpSymbol || pane.symbol,
        timeframe: pane.timeframe,
        range: pane.range,
        toDate,
        adjusted: backAdjusted ? '1' : '0',
        eth: ethSession,
      });

      fetch(`/api/market/candles?${qs.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const bars: CandleBar[] = Array.isArray(data?.candles) ? data.candles : [];
          const current = candleCacheRef.current[key];
          if (!current || current.candles.length === 0) return;

          // History is strictly additive: only bars older than everything already loaded are
          // inserted, so the running candle and live-updated bars are never replaced.
          const oldestLoaded = current.candles[0].time;
          const loadedTimes = new Set(current.candles.map((c) => c.time));
          const olderBars = bars
            .filter((c) => c.time < oldestLoaded && !loadedTimes.has(c.time))
            .sort((a, b) => a.time - b.time);

          paging.exhausted = olderBars.length === 0;
          if (olderBars.length === 0) return;

          setCandleCache((prev) => {
            const entry = prev[key];
            if (!entry || entry.candles.length === 0) return prev;
            const have = new Set(entry.candles.map((c) => c.time));
            const toPrepend = olderBars.filter(
              (c) => c.time < entry.candles[0].time && !have.has(c.time)
            );
            if (toPrepend.length === 0) return prev;
            return { ...prev, [key]: { ...entry, candles: [...toPrepend, ...entry.candles] } };
          });
        })
        .catch(() => {
          // Leave the cache untouched; a later scroll retries
        })
        .finally(() => {
          paging.loading = false;
        });
    },
    [backAdjusted, ethSession]
  );

  const handleCloneDrawing = useCallback(
    (source: ChartDrawing) => {
      const basePrice =
        activeSymbolObj.price > 0
          ? activeSymbolObj.price
          : candles[candles.length - 1]?.close ?? 100;
      const offsetPrice = basePrice * 0.0008;
      const tfSec = Math.max(60, parseTimeframeToSeconds(activeTimeframe));
      const cloned: ChartDrawing = {
        ...translateDrawing(source, tfSec * 5, -offsetPrice),
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        locked: false,
      };
      commitDrawingsChange((prev) => [...prev, cloned]);
      setSelectedDrawingId(cloned.id);
    },
    [activeSymbolObj.price, activeTimeframe, candles, commitDrawingsChange]
  );

  const handleRemoveDrawing = useCallback(
    (id: string) => {
      commitDrawingsChange((prev) => prev.filter((item) => item.id !== id));
      setSelectedDrawingId((cur) => (cur === id ? null : cur));
    },
    [commitDrawingsChange]
  );

  const handleToggleIndicator = useCallback((id: string) => {
    setIndicators((prev) =>
      prev.map((ind) => {
        if (ind.id !== id) return ind;
        if (ind.removed) {
          return { ...ind, visible: true, removed: false };
        }
        return { ...ind, visible: !ind.visible, removed: false };
      })
    );
  }, []);

  const handleRemoveIndicator = useCallback((id: string) => {
    setIndicators((prev) =>
      prev.map((ind) =>
        ind.id === id ? { ...ind, visible: false, removed: true } : ind
      )
    );
  }, []);

  const handleReorderDrawing = useCallback(
    (id: string, direction: 'front' | 'back') => {
      commitDrawingsChange((prev) => {
        const idx = prev.findIndex((item) => item.id === id);
        if (idx === -1) return prev;
        const target = prev[idx];
        const rest = prev.filter((item) => item.id !== id);
        return direction === 'front' ? [...rest, target] : [target, ...rest];
      });
    },
    [commitDrawingsChange]
  );

  const handleClearDrawings = useCallback(() => {
    setDrawings((prev) => {
      if (prev.length === 0) return prev;
      setDrawingPast((past) => [...past.slice(-39), prev]);
      setDrawingFuture([]);
      return [];
    });
    setSelectedDrawingId(null);
  }, []);

  const handleUndoDrawing = useCallback(() => {
    setDrawingPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setDrawings((curr) => {
        setDrawingFuture((fut) => [curr, ...fut.slice(0, 39)]);
        return previous;
      });
      setSelectedDrawingId(null);
      return past.slice(0, -1);
    });
  }, []);

  const handleRedoDrawing = useCallback(() => {
    setDrawingFuture((fut) => {
      if (fut.length === 0) return fut;
      const next = fut[0];
      setDrawings((curr) => {
        setDrawingPast((past) => [...past.slice(-39), curr]);
        return next;
      });
      setSelectedDrawingId(null);
      return fut.slice(1);
    });
  }, []);

  const handleToggleFavoriteTool = useCallback((toolId: DrawingToolId) => {
    setFavoriteToolIds((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    );
  }, []);

  // Global TradingView Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (activeTool !== 'cursor') {
          setActiveTool('cursor');
        } else if (selectedDrawingId) {
          setSelectedDrawingId(null);
        }
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        const targetDrawing = drawings.find((d) => d.id === selectedDrawingId);
        if (targetDrawing && !targetDrawing.locked && !drawingsLocked) {
          e.preventDefault();
          handleRemoveDrawing(selectedDrawingId);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedoDrawing();
        else handleUndoDrawing();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoDrawing();
        return;
      }

      if (e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          setActiveTool('trend-line');
        } else if (key === 'h') {
          e.preventDefault();
          setActiveTool('horizontal-line');
        } else if (key === 'j') {
          e.preventDefault();
          setActiveTool('horizontal-ray');
        } else if (key === 'v') {
          e.preventDefault();
          setActiveTool('vertical-line');
        } else if (key === 'c') {
          e.preventDefault();
          setActiveTool('cross-line');
        } else if (key === 'f') {
          e.preventDefault();
          setActiveTool('fib-levels');
        } else if (key === 'r') {
          e.preventDefault();
          setActiveTool('rectangle');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTool,
    selectedDrawingId,
    drawings,
    drawingsLocked,
    handleRemoveDrawing,
    handleUndoDrawing,
    handleRedoDrawing,
  ]);

  const alertBadgeCount = alerts.filter((a) => a.active).length;

  // Build unified preferences snapshot for the local cache & D1 sync
  const buildCurrentPreferences = useCallback(
    (): WorkspacePreferencesState => ({
      appTheme,
      chartCanvasTheme,
      chartSettings,
      indicators,
      volumeProfileConfig,
      gexOverlayConfig,
      watchlistSymbols,
      customTimeframes,
      layoutId,
      layoutSync,
      panes,
      activePaneId,
      favoriteToolIds,
      favoritesBarVisible,
      magnetActive,
      stayInDrawingMode,
      drawingsLocked,
      drawingsHidden,
      ethSession,
      backAdjusted,
      logScale,
      autoScale,
      timezoneId,
      rightPanelOpen,
      rightRailTab,
    }),
    [
      appTheme,
      chartCanvasTheme,
      chartSettings,
      indicators,
      volumeProfileConfig,
      gexOverlayConfig,
      watchlistSymbols,
      customTimeframes,
      layoutId,
      layoutSync,
      panes,
      activePaneId,
      favoriteToolIds,
      favoritesBarVisible,
      magnetActive,
      stayInDrawingMode,
      drawingsLocked,
      drawingsHidden,
      ethSession,
      backAdjusted,
      logScale,
      autoScale,
      timezoneId,
      rightPanelOpen,
      rightRailTab,
    ]
  );

  const latestPrefsRef = useRef<WorkspacePreferencesState>(buildCurrentPreferences());
  latestPrefsRef.current = buildCurrentPreferences();
  const latestDrawingsRef = useRef<ChartDrawing[]>(drawings);
  latestDrawingsRef.current = drawings;
  const latestTemplatesRef = useRef<DrawingTemplate[]>(drawingTemplates);
  latestTemplatesRef.current = drawingTemplates;
  const latestAlertsRef = useRef<PriceAlert[]>(alerts);
  latestAlertsRef.current = alerts;
  const latestPositionsRef = useRef<TradePosition[]>(positions);
  latestPositionsRef.current = positions;

  const handleSyncNow = useCallback(async () => {
    const snapshot = {
      preferences: latestPrefsRef.current,
      drawings: latestDrawingsRef.current,
      drawingTemplates: latestTemplatesRef.current,
      alerts: latestAlertsRef.current,
      positions: latestPositionsRef.current,
    };
    const result = await forceSaveWorkspaceToServer(snapshot);
    if (result.ok) {
      setSyncToast({ kind: 'success', message: 'Workspace saved to your account.' });
    } else {
      setSyncToast({
        kind: 'error',
        message: result.error
          ? `Save failed: ${result.error}`
          : 'Save failed. Signed in?',
      });
    }
  }, []);

  // 5. Persist workspace locally, then queue the same snapshot for D1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snapshot = {
        preferences: latestPrefsRef.current,
        drawings,
        drawingTemplates,
        alerts,
        positions,
      };
      saveGuestWorkspace(snapshot);
      // Persist the same snapshot to the account row in D1
      queueRemoteWorkspaceSave(snapshot);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    appTheme,
    chartCanvasTheme,
    chartSettings,
    indicators,
    volumeProfileConfig,
    gexOverlayConfig,
    watchlistSymbols,
    customTimeframes,
    layoutId,
    layoutSync,
    panes,
    activePaneId,
    favoriteToolIds,
    favoritesBarVisible,
    magnetActive,
    stayInDrawingMode,
    drawingsLocked,
    drawingsHidden,
    ethSession,
    backAdjusted,
    logScale,
    autoScale,
    timezoneId,
    rightPanelOpen,
    rightRailTab,
    drawings,
    drawingTemplates,
    alerts,
    positions,
  ]);

  const handleSaveDrawingTemplate = useCallback((tpl: DrawingTemplate) => {
    setDrawingTemplates((prev) => [tpl, ...prev].slice(0, 24));
  }, []);

  // Signed-out visitors get the account page; the server rejects workspace
  // reads and writes without a valid session cookie.
  if (!accountUser) {
    // Reload after auth so main.tsx can restore this account's workspace from D1
    // before the app reads its local cache.
    return <AuthPage onAuthenticated={() => window.location.reload()} />;
  }

  return (
    <div className="relative w-full min-h-[100dvh] md:h-[100dvh] bg-[var(--tv-bg-app)] text-[var(--tv-text)] overflow-y-auto md:overflow-hidden select-none">
      {/* Live Animated Wallpaper Layer */}
      <div className="fixed inset-0 pointer-events-none">
        <LiveWallpaperCanvas theme={appTheme} />
      </div>

      {/* Main Frosted Glass Terminal Layer */}
      <div className="relative z-10 flex flex-col w-full min-h-[100dvh] md:h-full md:overflow-hidden">
      {/* Top Navigation & Chart Controls Bar */}
      <TopToolbar
        activeSymbol={activeSymbol}
        onOpenSymbolSearch={(mode) => {
          setSymbolModalMode(mode);
          setSymbolModalOpen(true);
        }}
        activeTheme={appTheme}
        onOpenThemeStudio={() => setThemeStudioOpen(true)}
        activeTimeframe={activeTimeframe}
        timeframes={DEFAULT_TIMEFRAMES}
        customTimeframes={customTimeframes}
        onSelectTimeframe={(tf) => setActiveTimeframe(tf)}
        onAddCustomTimeframe={handleAddCustomTimeframe}
        onRemoveCustomTimeframe={handleRemoveCustomTimeframe}
        chartStyle={chartStyle}
        onSelectChartStyle={setChartStyle}
        onOpenIndicators={() => setIndicatorsModalOpen(true)}
        activeIndicatorsCount={indicators.filter((i) => !i.removed && i.visible).length}
        onOpenAlertModal={() => setAlertModalOpen(true)}
        replayActive={replayActive}
        onToggleReplay={() => {
          setReplayActive((v) => !v);
          setReplayPlaying(false);
        }}
        onOpenTradeTicket={() => {
          if (rightPanelOpen && rightRailTab === 'dom_trade') {
            setRightPanelOpen(false);
          } else {
            setRightRailTab('dom_trade');
            setRightPanelOpen(true);
          }
        }}
        onOpenScreener={() => {
          if (rightPanelOpen && rightRailTab === 'screener_factors') {
            setRightPanelOpen(false);
          } else {
            setRightRailTab('screener_factors');
            setRightPanelOpen(true);
          }
        }}
        onOpenUsageModal={() => setUsageModalOpen(true)}
        onOpenSettings={() => {
          setSettingsInitialTab('symbol');
          setSettingsModalOpen(true);
        }}
        activeLayoutId={layoutId}
        onSelectLayout={handleSelectLayout}
        layoutSync={layoutSync}
        onToggleLayoutSync={handleToggleLayoutSync}
        alertBadgeCount={alertBadgeCount}
        chartCanvasTheme={chartCanvasTheme}
        onToggleChartCanvasTheme={handleToggleChartCanvasTheme}
        wsConnected={wsConnected}
        httpLiveActive={httpLiveActive}
        liveStreamEnabled={liveStreamEnabled}
        onToggleLiveStream={handleToggleLiveStream}
        onOpenGexDashboard={() => handleOpenGexDashboard()}
        accountName={accountUser.name || accountUser.email}
        onSignOut={() => {
          void logOutAccount().finally(() => window.location.reload());
        }}
        onSyncNow={handleSyncNow}
      />

      {/* Main Middle Workspace */}
      <div className="flex flex-1 min-h-[460px] md:min-h-0 overflow-hidden">
        <LeftDrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          favoritesBarVisible={favoritesBarVisible}
          onToggleFavoritesBar={() => setFavoritesBarVisible((v) => !v)}
          favoriteToolIds={favoriteToolIds}
          onToggleFavoriteTool={handleToggleFavoriteTool}
          magnetActive={magnetActive}
          onToggleMagnet={() => setMagnetActive((v) => !v)}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          drawingsLocked={drawingsLocked}
          onToggleLockDrawings={() => setDrawingsLocked((v) => !v)}
          drawingsHidden={drawingsHidden}
          onToggleHideDrawings={() => setDrawingsHidden((v) => !v)}
          onClearDrawings={handleClearDrawings}
          onZoomIn={() => setZoomTrigger((z) => z + 1)}
        />

        {/* Center Column: Single or Multi-Chart Grid + Bottom Timeframe Range & Clock Bar */}
        <main className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <div
            className={`flex-1 min-h-0 grid ${
              currentLayoutPreset.count > 1 ? 'gap-[2px]' : ''
            } bg-transparent overflow-hidden`}
            style={{
              gridTemplateColumns: `repeat(${currentLayoutPreset.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${currentLayoutPreset.rows}, minmax(0, 1fr))`,
            }}
          >
            {visiblePanes.map((pane, idx) => {
              const slot = currentLayoutPreset.slots[idx] || {};
              const paneSymbolObj =
                symbols.find((s) => s.symbol === pane.symbol) || symbols[0];
              const paneCacheKey = makeCandleCacheKey(
                pane.symbol,
                pane.timeframe,
                pane.range,
                pane.toDate,
                backAdjusted,
                ethSession
              );
              const paneEntry = candleCache[paneCacheKey];
              const paneCandles = paneEntry?.candles ?? [];
              const paneLoading = paneEntry ? paneEntry.loading : true;
              const paneError = paneEntry?.error ?? null;
              const paneSource = paneEntry?.source ?? 'lse-export';
              const isPaneActive = pane.id === activePane.id;

              const paneResolvedGex = resolveGexUnderlyingForSymbol(
                paneSymbolObj.symbol,
                paneSymbolObj.lseMarket,
                paneSymbolObj.lseHttpSymbol,
                gexOverlayConfig.futuresProxyEnabled
              );
              const paneGexKey = paneResolvedGex
                ? `${paneResolvedGex.underlying}__${gexOverlayConfig.expiryMode || '0dte'}__${currentEtDate}`
                : '';
              const paneGexEntry = paneGexKey ? gexDataCache[paneGexKey] : undefined;
              const rawPaneGexData = paneGexEntry?.data ?? null;
              const livePaneSpot =
                paneCandles[paneCandles.length - 1]?.close || paneSymbolObj.price;
              const proxyAnchorKey = paneGexKey ? `${paneSymbolObj.symbol}__${paneGexKey}` : '';
              const paneSpotForScale = rawPaneGexData
                ? resolveChartGexScaleSpot(
                    staticProxyAnchorRef.current,
                    proxyAnchorKey,
                    rawPaneGexData.spotPrice,
                    livePaneSpot,
                    Boolean(gexOverlayConfig.dynamicSpotTracking)
                  )
                : livePaneSpot;
              const proxyUnderlyingPrice = paneResolvedGex?.isFuturesProxy
                ? symbols.find(
                    (s) =>
                      s.symbol.toUpperCase() === paneResolvedGex.underlying.toUpperCase() ||
                      s.lseHttpSymbol.toUpperCase() === paneResolvedGex.underlying.toUpperCase()
                  )?.price ?? 0
                : paneSpotForScale;
              const effectiveGexData =
                rawPaneGexData && gexOverlayConfig.dynamicSpotTracking && proxyUnderlyingPrice > 0
                  ? projectGexDashboardAtSpot(rawPaneGexData, proxyUnderlyingPrice)
                  : rawPaneGexData;

              const paneGexLevels: ChartGexOverlayLevel[] = gexIndicatorVisible
                ? effectiveGexData
                  ? buildChartGexLevels(
                      effectiveGexData,
                      gexOverlayConfig,
                      paneSymbolObj.symbol,
                      paneSpotForScale
                    )
                  : gexOverlayLevels
                : [];
              const paneGexSpotScaleRatio =
                effectiveGexData &&
                paneResolvedGex?.isFuturesProxy &&
                effectiveGexData.spotPrice > 0 &&
                paneSpotForScale > 0
                  ? paneSpotForScale / effectiveGexData.spotPrice
                  : 1;

              return (
                <div
                  key={pane.id}
                  onMouseDown={() => {
                    if (activePaneId !== pane.id) {
                      setActivePaneId(pane.id);
                    }
                  }}
                  style={{
                    gridColumn: slot.colSpan ? `span ${slot.colSpan}` : undefined,
                    gridRow: slot.rowSpan ? `span ${slot.rowSpan}` : undefined,
                  }}
                  className="min-w-0 min-h-0 w-full h-full overflow-hidden flex flex-col"
                >
                  <ChartWorkspace
                    paneId={pane.id}
                    isActivePane={isPaneActive}
                    isMultiPane={currentLayoutPreset.count > 1}
                    onFocusPane={() => setActivePaneId(pane.id)}
                    symbolInfo={paneSymbolObj}
                    timeframe={pane.timeframe}
                    candles={paneCandles}
                    onLoadOlderCandles={() => handleLoadOlderCandles(pane)}
                    chartStyle={pane.chartStyle}
                    chartCanvasTheme={chartCanvasTheme}
                    chartSettings={chartSettings}
                    appTheme={appTheme}
                    onOpenSettings={(tab) => {
                      setSettingsInitialTab(tab || 'symbol');
                      setSettingsModalOpen(true);
                    }}
                    syncedCrosshair={layoutSync.crosshair ? syncedCrosshair : null}
                    onCrosshairSync={(time) => {
                      if (!layoutSync.crosshair) return;
                      setSyncedCrosshair(
                        time !== null ? { time, sourcePaneId: pane.id } : null
                      );
                    }}
                    syncedTimeRange={layoutSync.time ? syncedTimeRange : null}
                    onTimeRangeSync={(range) => {
                      if (!layoutSync.time || !range) return;
                      setSyncedTimeRange({
                        from: range.from,
                        to: range.to,
                        sourcePaneId: pane.id,
                      });
                    }}
                    activeTool={activeTool}
                    onSelectTool={setActiveTool}
                    favoriteToolIds={favoriteToolIds}
                    magnetActive={magnetActive}
                    stayInDrawingMode={stayInDrawingMode}
                    drawingsLocked={drawingsLocked}
                    drawingsHidden={drawingsHidden}
                    drawings={drawings}
                    selectedDrawingId={selectedDrawingId}
                    onSelectDrawing={setSelectedDrawingId}
                    onAddDrawing={handleAddDrawing}
                    onUpdateDrawing={handleUpdateDrawing}
                    onCloneDrawing={handleCloneDrawing}
                    onRemoveDrawing={handleRemoveDrawing}
                    onReorderDrawing={handleReorderDrawing}
                    drawingTemplates={drawingTemplates}
                    onSaveDrawingTemplate={handleSaveDrawingTemplate}
                    favoritesBarVisible={favoritesBarVisible && isPaneActive}
                    indicators={indicators}
                    onToggleIndicatorVisibility={handleToggleIndicator}
                    onRemoveIndicator={handleRemoveIndicator}
                    compareOverlays={isPaneActive ? compareOverlays : []}
                    onRemoveCompareOverlay={(sym) =>
                      setCompareOverlays((prev) => prev.filter((o) => o.symbol !== sym))
                    }
                    positions={positions}
                    onQuickOrder={(side) => handleQuickOrder(side, 1)}
                    onClosePosition={(id) =>
                      setPositions((prev) => prev.filter((p) => p.id !== id))
                    }
                    alerts={alerts}
                    replayActive={replayActive && isPaneActive}
                    replayIndex={replayIndex}
                    replayPlaying={replayPlaying}
                    onReplayTogglePlay={() => setReplayPlaying((p) => !p)}
                    onReplayStep={() =>
                      setReplayIndex((curIdx) => Math.min(paneCandles.length, curIdx + 1))
                    }
                    onReplayExit={() => {
                      setReplayActive(false);
                      setReplayPlaying(false);
                    }}
                    zoomTrigger={isPaneActive ? zoomTrigger : 0}
                    logScale={logScale}
                    autoScale={autoScale}
                    onToggleLogScale={() => setLogScale((l) => !l)}
                    onToggleAutoScale={() => setAutoScale((a) => !a)}
                    onOpenNewsDrawer={() => {
                      setRightRailTab('news_calendar');
                      setRightPanelOpen(true);
                    }}
                    candleDataSource={paneSource}
                    loadingCandles={paneLoading}
                    candlesError={paneError}
                    onRetryCandles={() => setCandlesRetrySeq((c) => c + 1)}
                    timezoneId={timezoneId}
                    liveTickDeltas={liveTickDeltas[paneCacheKey]}
                    gexOverlayLevels={paneGexLevels}
                    gexData={effectiveGexData}
                    gexRawSpotPrice={rawPaneGexData?.spotPrice ?? null}
                    gexLoading={paneGexEntry?.loading ?? false}
                    gexError={paneGexEntry?.error ?? null}
                    gexOverlayConfig={gexOverlayConfig}
                    gexIndicatorVisible={gexIndicatorVisible}
                    gexResolvedInfo={paneResolvedGex}
                    gexSpotScaleRatio={paneGexSpotScaleRatio}
                    onToggleGexIndicator={() => handleToggleIndicator('gex-levels')}
                    onUpdateGexConfig={(patch) =>
                      setGexOverlayConfig((prev) => ({ ...prev, ...patch }))
                    }
                    onRefreshGex={() => {
                      if (proxyAnchorKey) {
                        delete staticProxyAnchorRef.current[proxyAnchorKey];
                      }
                      setGexRetrySeq((c) => c + 1);
                    }}
                    onOpenGexModal={() =>
                      handleOpenGexDashboard(paneResolvedGex?.underlying || pane.symbol)
                    }
                    volumeProfileConfig={volumeProfileConfig}
                    onUpdateVolumeProfileConfig={(patch) =>
                      setVolumeProfileConfig((prev) => ({ ...prev, ...patch }))
                    }
                  />
                </div>
              );
            })}
          </div>

          <BottomBar
            activeRange={activeRange}
            onSelectRange={(r) => setActiveRangeAndDate(r, '')}
            toDate={toDate}
            onSelectToDate={setToDate}
            ethSession={ethSession}
            onToggleEthSession={() => setEthSession((s) => (s === 'ETH' ? 'RTH' : 'ETH'))}
            backAdjusted={backAdjusted}
            onToggleBackAdjusted={() => setBackAdjusted((b) => !b)}
            logScale={logScale}
            onToggleLogScale={() => setLogScale((l) => !l)}
            autoScale={autoScale}
            onToggleAutoScale={() => setAutoScale((a) => !a)}
            loadingCandles={loadingCandles}
            timezoneId={timezoneId}
            onSelectTimezone={setTimezoneId}
            activeSymbolMarket={activeSymbolObj.lseMarket}
          />
        </main>

        {/* Right Watchlist, Symbol Details, Economic Calendar & Tools Rail */}
        <RightSidebar
          symbols={symbols}
          watchlistSymbols={watchlistSymbols}
          activeSymbol={activeSymbol}
          activeTimeframe={activeTimeframe}
          onSelectSymbol={(sym) => setActiveSymbol(sym)}
          onRemoveFromWatchlist={(sym) =>
            setWatchlistSymbols((prev) => prev.filter((item) => item !== sym))
          }
          onToggleSymbolFlag={handleToggleSymbolFlag}
          onOpenAddSymbol={() => {
            setSymbolModalMode('watchlist');
            setSymbolModalOpen(true);
          }}
          onRefreshQuotes={handleRefreshQuotes}
          economicEvents={economicEvents}
          bondYields={bondYields}
          symbolDetails={symbolDetails}
          loadingDetails={loadingDetails}
          tickTape={tickTape}
          activeTab={rightRailTab}
          panelOpen={rightPanelOpen}
          onSelectTab={(tab) => {
            if (rightPanelOpen && rightRailTab === tab) {
              setRightPanelOpen(false);
            } else {
              setRightRailTab(tab);
              setRightPanelOpen(true);
            }
          }}
          alerts={alerts}
          onOpenCreateAlert={() => setAlertModalOpen(true)}
          onRemoveAlert={(id) => setAlerts((prev) => prev.filter((a) => a.id !== id))}
          drawings={drawings}
          selectedDrawingId={selectedDrawingId}
          onSelectDrawing={setSelectedDrawingId}
          onUpdateDrawing={handleUpdateDrawing}
          onRemoveDrawing={handleRemoveDrawing}
          indicators={indicators}
          onToggleIndicator={handleToggleIndicator}
          onRemoveIndicator={handleRemoveIndicator}
          positions={positions}
          onQuickOrder={handleQuickOrder}
          onClosePosition={(id) => setPositions((prev) => prev.filter((p) => p.id !== id))}
          lastTickSymbol={lastTickSymbol}
          onOpenUsageModal={() => setUsageModalOpen(true)}
          onSelectOptionContract={handleOpenOptionContract}
          onOpenGexDashboard={(ticker) => handleOpenGexDashboard(ticker)}
        />
      </div>

      {/* Sync toast — does not touch chart or pane state */}
      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 right-4 z-[100] max-w-xs tv-glass-popover border rounded-xl px-3 py-2 text-sm shadow-lg ${
            syncToast.kind === 'success'
              ? 'border-[var(--tv-bull)]/40 text-[var(--tv-bull)]'
              : 'border-[var(--tv-bear)]/40 text-[var(--tv-bear)]'
          }`}
        >
          {syncToast.kind === 'success' ? 'Saved' : 'Could not save'}{' '}
          <button
            type="button"
            onClick={() => setSyncToast(null)}
            className="ml-2 underline hover:no-underline"
            aria-label="Dismiss save message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Modals */}
      <SymbolSearchModal
        open={symbolModalOpen}
        mode={symbolModalMode}
        symbols={symbols}
        activeSymbol={activeSymbol}
        watchlistSymbols={watchlistSymbols}
        onSelectSymbol={(sym) => setActiveSymbol(sym)}
        onAddToWatchlist={(sym) =>
          setWatchlistSymbols((prev) => (prev.includes(sym) ? prev : [...prev, sym]))
        }
        onSelectLsePair={handleSelectLsePair}
        onClose={() => setSymbolModalOpen(false)}
      />

      <IndicatorsModal
        open={indicatorsModalOpen}
        indicators={indicators}
        onToggleIndicator={handleToggleIndicator}
        onRemoveIndicator={handleRemoveIndicator}
        onClose={() => setIndicatorsModalOpen(false)}
      />

      <CreateAlertModal
        open={alertModalOpen}
        symbolInfo={activeSymbolObj}
        onCreateAlert={(newAlert) =>
          setAlerts((prev) => [
            {
              ...newAlert,
              id: `alert-${Date.now()}`,
              triggered: false,
              createdAt: new Date().toLocaleTimeString(),
            },
            ...prev,
          ])
        }
        onClose={() => setAlertModalOpen(false)}
      />

      <LseAccountUsageModal
        open={usageModalOpen}
        usage={lseUsage}
        loading={loadingUsage}
        onRefreshUsage={fetchLseUsage}
        onReconnectWs={async () => {
          await fetch('/api/lse/ws/reconnect', { method: 'POST' });
          setTimeout(fetchLseUsage, 1200);
        }}
        onClose={() => setUsageModalOpen(false)}
      />

      <ChartSettingsModal
        open={settingsModalOpen}
        initialTab={settingsInitialTab}
        settings={chartSettings}
        chartCanvasTheme={chartCanvasTheme}
        onPreviewSettings={(next) => setChartSettings(next)}
        onCommitSettings={(next, nextTheme) => {
          setChartSettings(next);
          if (nextTheme) {
            setChartCanvasTheme(nextTheme);
          }
          try {
            localStorage.setItem(CHART_SETTINGS_STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          setSettingsModalOpen(false);
        }}
        onCancelSettings={(original) => {
          setChartSettings(original);
          setSettingsModalOpen(false);
        }}
      />

      <GexDashboardModal
        open={gexModalOpen}
        onClose={() => setGexModalOpen(false)}
        initialUnderlying={gexUnderlying}
        pinnedHorizon={gexOverlayConfig.expiryMode || '0dte'}
        pinnedUnderlying={
          gexIndicatorVisible
            ? resolveGexUnderlyingForSymbol(
                activeSymbolObj.symbol,
                activeSymbolObj.lseMarket,
                activeSymbolObj.lseHttpSymbol,
                gexOverlayConfig.futuresProxyEnabled
              )?.underlying ?? gexOverlayLevels[0]?.underlying ?? null
            : gexOverlayLevels[0]?.underlying ?? null
        }
        onTogglePinLevels={handleTogglePinGexLevels}
        onSelectOptionContract={handleOpenOptionContract}
      />

      <ThemeStudioModal
        open={themeStudioOpen}
        theme={appTheme}
        onUpdateTheme={handleUpdateAppTheme}
        onClose={() => setThemeStudioOpen(false)}
      />

      </div>
    </div>
  );
}
