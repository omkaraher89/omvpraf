export type ChartStyleType =
  | 'candles'
  | 'hollow_candles'
  | 'bars'
  | 'line'
  | 'area'
  | 'baseline'
  | 'heikin_ashi';

export type DrawingToolId =
  | 'cursor'
  | 'trend-line'
  | 'ray'
  | 'info-line'
  | 'extended-line'
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'vertical-line'
  | 'cross-line'
  | 'parallel-channel'
  | 'fib-levels'
  | 'fib-extension'
  | 'pitchfork'
  | 'liquidity-box'
  | 'stop-channel'
  | 'brush'
  | 'highlighter'
  | 'rectangle'
  | 'circle'
  | 'triangle'
  | 'text-note'
  | 'callout'
  | 'price-label'
  | 'long-position'
  | 'short-position'
  | 'price-range'
  | 'date-range'
  | 'volume-profile'
  | 'candle-pattern'
  | 'wave-path'
  | 'elliott-wave'
  | 'time-cycles'
  | 'measure';

export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export interface DrawingPoint {
  t: number; // Unix timestamp (seconds)
  p: number; // Price
}

export type TextAlignH = 'left' | 'center' | 'right';
export type TextAlignV = 'top' | 'middle' | 'bottom';
export type TextOrientation = 'along' | 'horizontal';

export interface ChartDrawing {
  id: string;
  symbol: string;
  tool: DrawingToolId;
  title?: string;
  points: DrawingPoint[];
  t1: number;
  p1: number;
  t2: number;
  p2: number;
  text?: string;
  showText?: boolean;
  textColor?: string;
  textBold?: boolean;
  textItalic?: boolean;
  textAlignH?: TextAlignH;
  textAlignV?: TextAlignV;
  textOrientation?: TextOrientation;
  textWrap?: boolean;
  color: string;
  showBorder?: boolean;
  borderOpacity?: number;
  fillColor?: string;
  showFill?: boolean;
  fillOpacity?: number;
  lineWidth?: number;
  lineStyle?: LineStyleType;
  fontSize?: number;
  locked?: boolean;
  visible?: boolean;
  visibleTimeframes?: string[];
  extendLeft?: boolean;
  extendRight?: boolean;
  showMidline?: boolean;
  midlineColor?: string;
  midlineOpacity?: number;
  midlineStyle?: LineStyleType;
  midlineWidth?: number;
  angleSnap?: boolean;
  leftEnd?: 'normal' | 'arrow';
  rightEnd?: 'normal' | 'arrow';
  showMiddlePoint?: boolean;
  showPriceRange?: boolean;
  showPercentChange?: boolean;
  showBarsRange?: boolean;
  showAngle?: boolean;
  alwaysShowStats?: boolean;
  showLabels?: boolean;
  fibRatios?: number[];
  reverseFib?: boolean;
  accountSize?: number;
  riskPct?: number;
  clonedBars?: Array<{ openOffset: number; highOffset: number; lowOffset: number; closeOffset: number }>;
}

export interface DrawingTemplate {
  id: string;
  name: string;
  toolGroup: 'line' | 'rectangle' | 'other';
  style: Partial<ChartDrawing>;
}

export interface IndicatorConfig {
  id: string;
  name: string;
  shortTitle: string;
  paramsText: string;
  visible: boolean;
  removed?: boolean;
  category: 'institutional' | 'overlay' | 'volume';
  color?: string;
}

export interface VolumeProfileConfig {
  periodMode: 'prev_day' | 'prev_week';
  rowCount: number;
  valueAreaPct: number;
  placement: 'right' | 'left';
  showValueArea: boolean;
  showPoc: boolean;
  showLabels: boolean;
  showUpDownSplit: boolean;
}

export const DEFAULT_VOLUME_PROFILE_CONFIG: VolumeProfileConfig = {
  periodMode: 'prev_day',
  rowCount: 32,
  valueAreaPct: 0.7,
  placement: 'right',
  showValueArea: true,
  showPoc: true,
  showLabels: true,
  showUpDownSplit: true,
};

export type RightRailTab =
  | 'watchlist'
  | 'alerts'
  | 'object_tree'
  | 'dom_trade'
  | 'options'
  | 'news_calendar'
  | 'screener_factors'
  | 'macro_yields'
  | 'tape'
  | 'export_tools';

export interface CompareOverlay {
  symbol: string;
  name: string;
  color: string;
  market: string;
  httpSymbol: string;
  candles: Array<{ time: number; close: number }>;
}

export interface LseUsageData {
  plan: string;
  product: string;
  key: string;
  calls_per_minute: number;
  connections: number;
  markets: string[];
  rows: {
    day: string;
    per_day: number;
    per_export: number;
    used_today: number;
    resets_in_seconds: number;
  };
  weekly: {
    allowance_bytes: number;
    used_bytes: number;
    week: string;
  };
  ws?: {
    dataWs: string;
    londonWs: string;
    subscribedCount: number;
    maxSubscriptions: number;
    subscribedSymbols: string[];
    lastTickAt: number | null;
  };
}

export interface EconomicEventItem {
  id: number | string;
  date: string;
  time: string;
  datetime: string;
  region_code: string;
  event: string;
  period_hint?: string | null;
  actual?: string | number | null;
  previous?: string | number | null;
  consensus?: string | number | null;
  forecast?: string | number | null;
}

export interface BondYieldItem {
  symbol: string;
  country_iso2: string;
  country_name: string;
  maturity: string;
  maturity_days: number;
  currency: string;
  date: string;
  close: number;
}

export interface TickTapeEntry {
  id: string;
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  ts: string;
  sourceSocket?: string;
}

export interface LseSymbolDetails {
  symbol: string;
  market: string;
  httpSymbol: string;
  history?: {
    first: string;
    last: string;
    rows: number;
    timeframe: string;
  };
  factors?: {
    dividendsCount: number;
    recentDividends: Array<{ ex_date?: string; amount?: number; currency?: string; declaration_date?: string }>;
    splits: Array<{ date?: string; numerator?: number; denominator?: number; ratio?: string }>;
  };
  profile?: {
    company_name?: string;
    exchange_full_name?: string;
    sector?: string;
    industry?: string;
    ceo?: string;
    description?: string;
    website?: string;
    market_cap?: number;
    beta?: number;
    full_time_employees?: number;
    country?: string;
  } | null;
}

export interface ChartSettingsConfig {
  // Symbol tab
  colorBarsOnPrevClose: boolean;
  showBody: boolean;
  bodyUpColor: string;
  bodyDownColor: string;
  showBorders: boolean;
  borderUpColor: string;
  borderDownColor: string;
  showWick: boolean;
  wickUpColor: string;
  wickDownColor: string;
  useCustomCandleColors: boolean;
  precision: 'Default' | '1' | '2' | '3' | '4' | '5';

  // Status line tab
  showLogo: boolean;
  showTitle: boolean;
  titleMode: 'Name' | 'Ticker' | 'Description';
  showOhlcValues: boolean;
  showBarChangeValues: boolean;
  showVolumeInLegend: boolean;
  showLastDayChange: boolean;
  showBuySellButtons: boolean;
  showIndicatorsLegend: boolean;

  // Scales and lines tab
  currencyUnitVisibility: 'Always visible' | 'Visible on mouse over' | 'Hidden';
  scaleModesVisibility: 'Always visible' | 'Visible on tap' | 'Always hidden';
  lockPriceToBarRatio: boolean;
  priceToBarRatio: number;
  scalesPlacement: 'Auto' | 'Left' | 'Right';
  noOverlappingLabels: boolean;
  plusButton: boolean;
  countdownToBarClose: boolean;
  symbolLastPriceMode: 'Name, value, line' | 'Value, line' | 'Line only';
  lastPriceLineVisible: boolean;
  lastPriceColor: string;

  // Canvas tab
  bgType: 'Solid' | 'Gradient';
  bgColor: string;
  bgColorBottom: string;
  useCustomCanvasColors: boolean;
  vertGridLines: boolean;
  vertGridColor: string;
  horzGridLines: boolean;
  horzGridColor: string;
  crosshairColor: string;
  crosshairStyle: 'dashed' | 'dotted' | 'solid';
  watermarkMode: 'Hidden' | 'Visible';
  watermarkColor: string;
  scalesTextColor: string;
  scalesFontSize: number;
  scalesLinesColor: string;

  // Trading tab
  showPositionsOnChart: boolean;
  showOrdersOnChart: boolean;
  instantOrdersPlacement: boolean;

  // Alerts tab
  showAlertsOnChart: boolean;
  onlyActiveAlerts: boolean;
  alertLineColor: string;

  // Events tab
  showEconomicEvents: boolean;
  showDividends: boolean;
  showSplits: boolean;
}

export function getDefaultChartSettings(theme: 'light' | 'dark' = 'light'): ChartSettingsConfig {
  const isLight = theme === 'light';
  return {
    colorBarsOnPrevClose: false,
    showBody: true,
    bodyUpColor: isLight ? '#ffffff' : '#089981',
    bodyDownColor: isLight ? '#434651' : '#f23645',
    showBorders: true,
    borderUpColor: isLight ? '#434651' : '#089981',
    borderDownColor: isLight ? '#434651' : '#f23645',
    showWick: true,
    wickUpColor: isLight ? '#434651' : '#089981',
    wickDownColor: isLight ? '#434651' : '#f23645',
    useCustomCandleColors: false,
    precision: 'Default',

    showLogo: false,
    showTitle: true,
    titleMode: 'Name',
    showOhlcValues: true,
    showBarChangeValues: true,
    showVolumeInLegend: false,
    showLastDayChange: false,
    showBuySellButtons: true,
    showIndicatorsLegend: true,

    currencyUnitVisibility: 'Always visible',
    scaleModesVisibility: 'Visible on tap',
    lockPriceToBarRatio: false,
    priceToBarRatio: 0.85,
    scalesPlacement: 'Auto',
    noOverlappingLabels: true,
    plusButton: true,
    countdownToBarClose: true,
    symbolLastPriceMode: 'Name, value, line',
    lastPriceLineVisible: true,
    lastPriceColor: '#9598a1',

    bgType: 'Solid',
    bgColor: isLight ? '#ffffff' : '#0f1219',
    bgColorBottom: isLight ? '#f4f6fa' : '#0a0d14',
    useCustomCanvasColors: false,
    vertGridLines: true,
    vertGridColor: isLight ? '#f2f4f8' : '#181c27',
    horzGridLines: true,
    horzGridColor: isLight ? '#f2f4f8' : '#181c27',
    crosshairColor: isLight ? '#9598a1' : '#5d606b',
    crosshairStyle: 'dashed',
    watermarkMode: 'Hidden',
    watermarkColor: isLight ? 'rgba(19, 23, 34, 0.08)' : 'rgba(224, 227, 235, 0.07)',
    scalesTextColor: isLight ? '#787b86' : '#868993',
    scalesFontSize: 11,
    scalesLinesColor: isLight ? '#e0e3eb' : '#222631',

    showPositionsOnChart: true,
    showOrdersOnChart: true,
    instantOrdersPlacement: false,

    showAlertsOnChart: true,
    onlyActiveAlerts: true,
    alertLineColor: '#f59e0b',

    showEconomicEvents: true,
    showDividends: true,
    showSplits: true,
  };
}

export interface LayoutSyncConfig {
  symbol: boolean;
  interval: boolean;
  crosshair: boolean;
  time: boolean;
  dateRange: boolean;
}

export interface LayoutSlot {
  colSpan?: number;
  rowSpan?: number;
}

export interface LayoutPreset {
  id: string;
  count: number;
  cols: number;
  rows: number;
  slots: LayoutSlot[];
  /** SVG preview boxes in 0..24 viewBox coordinates */
  svgRects: Array<[number, number, number, number]>;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  // 1
  {
    id: '1',
    count: 1,
    cols: 1,
    rows: 1,
    slots: [{}],
    svgRects: [[2, 2, 20, 20]],
  },
  // 2
  {
    id: '2-v',
    count: 2,
    cols: 2,
    rows: 1,
    slots: [{}, {}],
    svgRects: [[2, 2, 9.5, 20], [12.5, 2, 9.5, 20]],
  },
  {
    id: '2-h',
    count: 2,
    cols: 1,
    rows: 2,
    slots: [{}, {}],
    svgRects: [[2, 2, 20, 9.5], [2, 12.5, 20, 9.5]],
  },
  // 3
  {
    id: '3-v',
    count: 3,
    cols: 3,
    rows: 1,
    slots: [{}, {}, {}],
    svgRects: [[2, 2, 6, 20], [9, 2, 6, 20], [16, 2, 6, 20]],
  },
  {
    id: '3-h',
    count: 3,
    cols: 1,
    rows: 3,
    slots: [{}, {}, {}],
    svgRects: [[2, 2, 20, 6], [2, 9, 20, 6], [2, 16, 20, 6]],
  },
  {
    id: '3-left',
    count: 3,
    cols: 2,
    rows: 2,
    slots: [{ rowSpan: 2 }, {}, {}],
    svgRects: [[2, 2, 9.5, 20], [12.5, 2, 9.5, 9.5], [12.5, 12.5, 9.5, 9.5]],
  },
  {
    id: '3-right',
    count: 3,
    cols: 2,
    rows: 2,
    slots: [{}, { rowSpan: 2 }, {}],
    svgRects: [[2, 2, 9.5, 9.5], [12.5, 2, 9.5, 20], [2, 12.5, 9.5, 9.5]],
  },
  {
    id: '3-top',
    count: 3,
    cols: 2,
    rows: 2,
    slots: [{ colSpan: 2 }, {}, {}],
    svgRects: [[2, 2, 20, 9.5], [2, 12.5, 9.5, 9.5], [12.5, 12.5, 9.5, 9.5]],
  },
  {
    id: '3-bottom',
    count: 3,
    cols: 2,
    rows: 2,
    slots: [{}, {}, { colSpan: 2 }],
    svgRects: [[2, 2, 9.5, 9.5], [12.5, 2, 9.5, 9.5], [2, 12.5, 20, 9.5]],
  },
  // 4
  {
    id: '4-grid',
    count: 4,
    cols: 2,
    rows: 2,
    slots: [{}, {}, {}, {}],
    svgRects: [[2, 2, 9.5, 9.5], [12.5, 2, 9.5, 9.5], [2, 12.5, 9.5, 9.5], [12.5, 12.5, 9.5, 9.5]],
  },
  {
    id: '4-h',
    count: 4,
    cols: 1,
    rows: 4,
    slots: [{}, {}, {}, {}],
    svgRects: [[2, 2, 20, 4.2], [2, 7.2, 20, 4.2], [2, 12.5, 20, 4.2], [2, 17.8, 20, 4.2]],
  },
  {
    id: '4-v',
    count: 4,
    cols: 4,
    rows: 1,
    slots: [{}, {}, {}, {}],
    svgRects: [[2, 2, 4.2, 20], [7.2, 2, 4.2, 20], [12.5, 2, 4.2, 20], [17.8, 2, 4.2, 20]],
  },
  {
    id: '4-left',
    count: 4,
    cols: 2,
    rows: 3,
    slots: [{ rowSpan: 3 }, {}, {}, {}],
    svgRects: [[2, 2, 9.5, 20], [12.5, 2, 9.5, 6], [12.5, 9, 9.5, 6], [12.5, 16, 9.5, 6]],
  },
  {
    id: '4-top',
    count: 4,
    cols: 3,
    rows: 2,
    slots: [{ colSpan: 3 }, {}, {}, {}],
    svgRects: [[2, 2, 20, 9.5], [2, 12.5, 6, 9.5], [9, 12.5, 6, 9.5], [16, 12.5, 6, 9.5]],
  },
  // 6
  {
    id: '6-3x2',
    count: 6,
    cols: 3,
    rows: 2,
    slots: [{}, {}, {}, {}, {}, {}],
    svgRects: [
      [2, 2, 6, 9.5], [9, 2, 6, 9.5], [16, 2, 6, 9.5],
      [2, 12.5, 6, 9.5], [9, 12.5, 6, 9.5], [16, 12.5, 6, 9.5],
    ],
  },
  {
    id: '6-2x3',
    count: 6,
    cols: 2,
    rows: 3,
    slots: [{}, {}, {}, {}, {}, {}],
    svgRects: [
      [2, 2, 9.5, 6], [12.5, 2, 9.5, 6],
      [2, 9, 9.5, 6], [12.5, 9, 9.5, 6],
      [2, 16, 9.5, 6], [12.5, 16, 9.5, 6],
    ],
  },
  // 8
  {
    id: '8-4x2',
    count: 8,
    cols: 4,
    rows: 2,
    slots: [{}, {}, {}, {}, {}, {}, {}, {}],
    svgRects: [
      [2, 2, 4.2, 9.5], [7.2, 2, 4.2, 9.5], [12.5, 2, 4.2, 9.5], [17.8, 2, 4.2, 9.5],
      [2, 12.5, 4.2, 9.5], [7.2, 12.5, 4.2, 9.5], [12.5, 12.5, 4.2, 9.5], [17.8, 12.5, 4.2, 9.5],
    ],
  },
];

export interface ChartPaneConfig {
  id: string;
  symbol: string;
  timeframe: string;
  range: string;
  toDate: string;
  chartStyle: ChartStyleType;
}

export interface OptionChainContract {
  ticker: string;
  occSymbol: string;
  underlying: string;
  strike: number;
  expiry: string;
  contract_type: 'call' | 'put';
  last_price: number;
  volume_today: number;
  premium_today: number;
  underlying_price: number;
  dte: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  last_trade_at: string | null;
  updated_at: string | null;
}

export interface OptionFlowPrint {
  id: string;
  ts: string;
  underlying: string;
  ticker: string;
  occSymbol: string;
  strike: number;
  expiry: string;
  contract_type: 'call' | 'put';
  last_price: number;
  volume: number;
  premium: number;
  underlying_price: number;
  dte: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
}

export interface TimezoneOption {
  id: string;
  label: string;
  iana: string; // 'Exchange' resolves dynamically per symbol
  shortBadge: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'UTC', label: 'UTC', iana: 'UTC', shortBadge: 'UTC' },
  { id: 'Exchange', label: 'Exchange', iana: 'Exchange', shortBadge: 'EXCH' },
  { id: 'Pacific/Honolulu', label: '(UTC-10) Honolulu', iana: 'Pacific/Honolulu', shortBadge: 'UTC-10' },
  { id: 'America/Anchorage', label: '(UTC-9) Anchorage', iana: 'America/Anchorage', shortBadge: 'UTC-9' },
  { id: 'America/Juneau', label: '(UTC-9) Juneau', iana: 'America/Juneau', shortBadge: 'UTC-9' },
  { id: 'America/Los_Angeles', label: '(UTC-8) Los Angeles', iana: 'America/Los_Angeles', shortBadge: 'UTC-8' },
  { id: 'America/Vancouver', label: '(UTC-8) Vancouver', iana: 'America/Vancouver', shortBadge: 'UTC-8' },
  { id: 'America/Denver', label: '(UTC-7) Denver', iana: 'America/Denver', shortBadge: 'UTC-7' },
  { id: 'America/Phoenix', label: '(UTC-7) Phoenix', iana: 'America/Phoenix', shortBadge: 'UTC-7' },
  { id: 'America/Chicago', label: '(UTC-6) Chicago', iana: 'America/Chicago', shortBadge: 'UTC-6' },
  { id: 'America/Mexico_City', label: '(UTC-6) Mexico City', iana: 'America/Mexico_City', shortBadge: 'UTC-6' },
  { id: 'America/El_Salvador', label: '(UTC-6) San Salvador', iana: 'America/El_Salvador', shortBadge: 'UTC-6' },
  { id: 'America/Bogota', label: '(UTC-5) Bogota', iana: 'America/Bogota', shortBadge: 'UTC-5' },
  { id: 'America/Lima', label: '(UTC-5) Lima', iana: 'America/Lima', shortBadge: 'UTC-5' },
  { id: 'America/New_York', label: '(UTC-5) New York', iana: 'America/New_York', shortBadge: 'UTC-5' },
  { id: 'America/Toronto', label: '(UTC-5) Toronto', iana: 'America/Toronto', shortBadge: 'UTC-5' },
  { id: 'America/Caracas', label: '(UTC-4) Caracas', iana: 'America/Caracas', shortBadge: 'UTC-4' },
  { id: 'America/Halifax', label: '(UTC-4) Halifax', iana: 'America/Halifax', shortBadge: 'UTC-4' },
  { id: 'America/Argentina/Buenos_Aires', label: '(UTC-3) Buenos Aires', iana: 'America/Argentina/Buenos_Aires', shortBadge: 'UTC-3' },
  { id: 'America/Sao_Paulo', label: '(UTC-3) Sao Paulo', iana: 'America/Sao_Paulo', shortBadge: 'UTC-3' },
  { id: 'Europe/London', label: '(UTC+0) London', iana: 'Europe/London', shortBadge: 'UTC+0' },
  { id: 'Europe/Berlin', label: '(UTC+1) Berlin', iana: 'Europe/Berlin', shortBadge: 'UTC+1' },
  { id: 'Europe/Paris', label: '(UTC+1) Paris', iana: 'Europe/Paris', shortBadge: 'UTC+1' },
  { id: 'Europe/Zurich', label: '(UTC+1) Zurich', iana: 'Europe/Zurich', shortBadge: 'UTC+1' },
  { id: 'Europe/Athens', label: '(UTC+2) Athens', iana: 'Europe/Athens', shortBadge: 'UTC+2' },
  { id: 'Europe/Istanbul', label: '(UTC+3) Istanbul', iana: 'Europe/Istanbul', shortBadge: 'UTC+3' },
  { id: 'Asia/Riyadh', label: '(UTC+3) Riyadh', iana: 'Asia/Riyadh', shortBadge: 'UTC+3' },
  { id: 'Asia/Dubai', label: '(UTC+4) Dubai', iana: 'Asia/Dubai', shortBadge: 'UTC+4' },
  { id: 'Asia/Kolkata', label: '(UTC+5:30) Kolkata', iana: 'Asia/Kolkata', shortBadge: 'UTC+5:30' },
  { id: 'Asia/Bangkok', label: '(UTC+7) Bangkok', iana: 'Asia/Bangkok', shortBadge: 'UTC+7' },
  { id: 'Asia/Hong_Kong', label: '(UTC+8) Hong Kong', iana: 'Asia/Hong_Kong', shortBadge: 'UTC+8' },
  { id: 'Asia/Singapore', label: '(UTC+8) Singapore', iana: 'Asia/Singapore', shortBadge: 'UTC+8' },
  { id: 'Asia/Tokyo', label: '(UTC+9) Tokyo', iana: 'Asia/Tokyo', shortBadge: 'UTC+9' },
  { id: 'Asia/Seoul', label: '(UTC+9) Seoul', iana: 'Asia/Seoul', shortBadge: 'UTC+9' },
  { id: 'Australia/Sydney', label: '(UTC+10) Sydney', iana: 'Australia/Sydney', shortBadge: 'UTC+10' },
  { id: 'Pacific/Auckland', label: '(UTC+12) Auckland', iana: 'Pacific/Auckland', shortBadge: 'UTC+12' },
];

export function resolveTimezoneIana(
  tzId: string | undefined,
  lseMarket?: string
): string {
  if (!tzId || tzId === 'Exchange') {
    if (lseMarket === 'uk_stocks') return 'Europe/London';
    if (lseMarket === 'crypto' || lseMarket === 'forex') return 'UTC';
    if (lseMarket === 'ca_stocks') return 'America/Toronto';
    return 'America/New_York';
  }
  const match = TIMEZONE_OPTIONS.find((t) => t.id === tzId);
  return match ? match.iana : 'America/New_York';
}

export interface GexStrikeLevel {
  strike: number;
  callGex: number; // $M per 1% spot move (positive)
  putGex: number; // $M per 1% spot move (negative)
  netGex: number; // callGex + putGex
  absGex: number; // |callGex| + |putGex|
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
  callIv: number | null;
  putIv: number | null;
  callTicker?: string;
  putTicker?: string;
  callLast?: number;
  putLast?: number;
}

export interface GexSpotCurvePoint {
  spot: number;
  netGex: number; // $M per 1% spot move at simulated spot price
}

export interface OrderflowBucket {
  timeSec: number;
  label: string;
  callPremium: number;
  putPremium: number;
  netPremium: number;
  cumNetPremium: number;
  callVolume: number;
  putVolume: number;
  tradesCount: number;
  spotPrice: number | null;
  absorption?: 'bull' | 'bear' | null;
  absorptionIntensity?: number;
}

export interface OrderflowBarPoint {
  time: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  deltaPct: number;
  cvd: number;
  absorption: 'bull' | 'bear' | null;
  absorptionStrength: number;
  divergence: 'bull_div' | 'bear_div' | null;
  high: number;
  low: number;
  close: number;
}

export interface ChartGexOverlayLevel {
  id: string;
  key?: 'call_wall' | 'put_wall' | 'zero_gamma' | 'hvl_pin' | 'expected_move_up' | 'expected_move_dn' | 'secondary_call' | 'secondary_put';
  underlying: string;
  price: number;
  label: string;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
}

export type GexHorizonMode =
  | '0dte'
  | '1w'
  | 'weekly_strip'
  | 'monthly'
  | 'next_monthly'
  | 'all'
  | string;

export interface GexChartOverlayConfig {
  showCallWall: boolean;
  showPutWall: boolean;
  showZeroGamma: boolean;
  showHvlPin: boolean;
  showExpectedMove: boolean;
  showStrikeHistogram: boolean;
  showSecondaryWalls: boolean;
  expiryMode: GexHorizonMode; // '0dte' | '1w' | 'weekly_strip' | 'monthly' | 'all' | YYYY-MM-DD
  futuresProxyEnabled: boolean;
  dynamicSpotTracking: boolean;
}

export interface GexHorizonSummary {
  mode: '0dte' | '1w' | 'weekly_strip' | 'monthly' | 'all';
  label: string;
  expiry: string;
  dte: number;
  callWall: number | null;
  putWall: number | null;
  zeroGammaFlip: number | null;
  totalNetGexM: number;
  expectedMove: number | null;
}

export interface GexDashboardData {
  underlying: string;
  spotPrice: number;
  sessionDateEt?: string;
  horizonUsed?: string;
  expiryRangeLabel?: string;
  selectedExpiry: string;
  selectedDte: number;
  expiries: Array<{ expiry: string; dte: number; tag?: string }>;
  horizonSummaries?: GexHorizonSummary[];
  contractsCount: number;
  flowScopeUsed: '0dte' | 'all';
  bucketSeconds: number;
  metrics: {
    totalNetGexM: number;
    totalCallGexM: number;
    totalPutGexM: number;
    netDexM: number;
    callWall: number | null;
    putWall: number | null;
    zeroGammaFlip: number | null;
    maxPinStrike: number | null;
    hvlStrike: number | null;
    minAccelStrike: number | null;
    atmIv: number | null;
    expectedMove1D: number | null;
    expectedMoveUpper: number | null;
    expectedMoveLower: number | null;
    secondaryCallWalls: number[];
    secondaryPutWalls: number[];
    callVolume: number;
    putVolume: number;
    putCallRatio: number;
    totalCallPremium: number;
    totalPutPremium: number;
    netFlowPremium: number;
  };
  strikes: GexStrikeLevel[];
  gexCurve: GexSpotCurvePoint[];
  flowBuckets: OrderflowBucket[];
  recentFlowPrints: OptionFlowPrint[];
}

export type AppThemeId =
  | 'obsidian-glass'
  | 'midnight-aurora'
  | 'emerald-quant'
  | 'crimson-velvet'
  | 'sapphire-horizon'
  | 'amber-terminal'
  | 'cyber-violet'
  | 'nordic-slate'
  | 'tokyo-carbon'
  | 'arctic-daylight'
  | 'warm-alabaster'
  | 'sage-daylight'
  | 'custom';

export type LiveWallpaperMode =
  | 'none'
  | 'aurora'
  | 'constellation'
  | 'pulse'
  | 'grid-drift'
  | 'prism-waves'
  | 'starfield';

export interface AppThemeConfig {
  id: AppThemeId;
  name: string;
  isLight: boolean;
  appBg: string;
  panelBg: string;
  elevatedBg: string;
  inputBg: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentColor: string;
  bullColor: string;
  bearColor: string;
  chartBg: string;
  chartGridColor: string;
  glassOpacity: number;
  glassBlurPx: number;
  chartBgOpacity: number;
  wallpaperMode: LiveWallpaperMode;
  wallpaperOpacity: number;
  wallpaperSpeed: number;
  wallpaperColors: [string, string, string];
}

export interface SavedCloudLayout {
  id: string;
  name: string;
  layoutId: string;
  panes: ChartPaneConfig[];
  layoutSync: LayoutSyncConfig;
  indicators: IndicatorConfig[];
  activePaneId: string;
  updatedAtMs?: number;
}

export interface ClientIpInfo {
  ipDisplay: string;
  maskedIp: string;
  ipHash: string;
  deviceLabel: string;
  detectedAt: number;
}

export interface TrustedIpSession {
  id: string;
  maskedIp: string;
  deviceLabel: string;
  updatedAtMs?: number;
}

