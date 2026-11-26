import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Maximize2,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  LayoutGrid,
  Edit,
  Bookmark,
  Clock,
  Layers,
  Sparkles,
  Target,
  Triangle,
  Calendar,
  Rss,
  Bell,
  MessageSquare,
  Grid,
  HelpCircle,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  RefreshCw,
  Download,
  Activity,
} from 'lucide-react';
import {
  SymbolInfo,
  PriceAlert,
  TradePosition,
  formatPrice,
  calculatePositionPnL,
} from '../utils/marketEngine';
import {
  RightRailTab,
  ChartDrawing,
  IndicatorConfig,
  EconomicEventItem,
  BondYieldItem,
  TickTapeEntry,
  LseSymbolDetails,
  OptionChainContract,
  OptionFlowPrint,
} from '../types/trading';

interface RightSidebarProps {
  symbols: SymbolInfo[];
  watchlistSymbols: string[];
  activeSymbol: string;
  activeTimeframe: string;
  onSelectSymbol: (symbol: string) => void;
  onRemoveFromWatchlist: (symbol: string) => void;
  onToggleSymbolFlag: (symbol: string) => void;
  onOpenAddSymbol: () => void;
  onRefreshQuotes: () => void;
  economicEvents: EconomicEventItem[];
  bondYields: BondYieldItem[];
  symbolDetails: LseSymbolDetails | null;
  loadingDetails: boolean;
  tickTape: TickTapeEntry[];
  activeTab: RightRailTab;
  panelOpen?: boolean;
  onSelectTab: (tab: RightRailTab) => void;
  alerts: PriceAlert[];
  onOpenCreateAlert: () => void;
  onRemoveAlert: (id: string) => void;
  drawings: ChartDrawing[];
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string | null) => void;
  onUpdateDrawing: (drawing: ChartDrawing) => void;
  onRemoveDrawing: (id: string) => void;
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
  onRemoveIndicator?: (id: string) => void;
  positions: TradePosition[];
  onQuickOrder: (side: 'BUY' | 'SELL', qty?: number, stopLoss?: number, takeProfit?: number) => void;
  onClosePosition: (id: string) => void;
  lastTickSymbol: string | null;
  onOpenUsageModal: () => void;
  onSelectOptionContract?: (contract: {
    occSymbol: string;
    underlying: string;
    strike: number;
    expiry: string;
    contract_type: 'call' | 'put';
  }) => void;
  onOpenGexDashboard?: (underlying: string) => void;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
  symbols,
  watchlistSymbols,
  activeSymbol,
  activeTimeframe,
  onSelectSymbol,
  onRemoveFromWatchlist,
  onToggleSymbolFlag,
  onOpenAddSymbol,
  onRefreshQuotes,
  economicEvents,
  bondYields,
  symbolDetails,
  loadingDetails,
  tickTape,
  activeTab,
  panelOpen = true,
  onSelectTab,
  alerts,
  onOpenCreateAlert,
  onRemoveAlert,
  drawings,
  selectedDrawingId,
  onSelectDrawing,
  onUpdateDrawing,
  onRemoveDrawing,
  indicators,
  onToggleIndicator,
  onRemoveIndicator,
  positions,
  onQuickOrder,
  onClosePosition,
  lastTickSymbol,
  onOpenUsageModal,
  onSelectOptionContract,
  onOpenGexDashboard,
}) => {
  const [watchlistFilter, setWatchlistFilter] = useState<'all' | 'flagged'>('all');
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [watchlistMenuOpen, setWatchlistMenuOpen] = useState(false);
  const watchlistMenuRef = useRef<HTMLDivElement>(null);

  // DOM Order Ticket inputs
  const [orderQty, setOrderQty] = useState<number>(1);
  const [orderSl, setOrderSl] = useState<string>('');
  const [orderTp, setOrderTp] = useState<string>('');

  // US Options Chain & Flow state
  const [optSubTab, setOptSubTab] = useState<'chain' | 'flow'>('chain');
  const [optUnderlying, setOptUnderlying] = useState<string>('AAPL');
  const [optDraftTicker, setOptDraftTicker] = useState<string>('AAPL');
  const [optContractType, setOptContractType] = useState<'all' | 'call' | 'put'>('all');
  const [optSelectedExpiry, setOptSelectedExpiry] = useState<string>('');
  const [optFlowAllMarket, setOptFlowAllMarket] = useState<boolean>(false);
  const [optMinPremium, setOptMinPremium] = useState<number>(25000);
  const [optChainData, setOptChainData] = useState<{
    underlyingPrice: number | null;
    expiries: string[];
    contracts: OptionChainContract[];
  } | null>(null);
  const [optFlowPrints, setOptFlowPrints] = useState<OptionFlowPrint[]>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // LSE CSV Estimator & Export form state
  const [expFrom, setExpFrom] = useState<string>(() =>
    new Date(Date.now() - 3 * 86400 * 1000).toISOString().slice(0, 10)
  );
  const [expTo, setExpTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [expTf, setExpTf] = useState<string>('1m');
  const [estimateResult, setEstimateResult] = useState<{
    rows?: number;
    bytes?: number;
    error?: string;
  } | null>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (watchlistMenuRef.current && !watchlistMenuRef.current.contains(e.target as Node)) {
        setWatchlistMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selectedSymbolObj = symbols.find((s) => s.symbol === activeSymbol) || symbols[0];

  // Auto-follow active US stock symbol in Options panel when user switches chart to a stock
  useEffect(() => {
    if (selectedSymbolObj?.lseMarket === 'us_stocks') {
      const sym = selectedSymbolObj.symbol.toUpperCase();
      setOptUnderlying(sym);
      setOptDraftTicker(sym);
      setOptSelectedExpiry('');
    }
  }, [selectedSymbolObj?.lseMarket, selectedSymbolObj?.symbol]);

  // Fetch LSE US Options Chain & Flow lazily when Options panel is active
  useEffect(() => {
    if (!panelOpen || activeTab !== 'options') return;
    let cancelled = false;
    setLoadingOptions(true);
    setOptionsError(null);

    const run = async () => {
      try {
        if (optSubTab === 'chain') {
          const qs = new URLSearchParams({
            underlying: optUnderlying,
            limit: '150',
          });
          if (optContractType !== 'all') qs.set('contract_type', optContractType);
          if (optSelectedExpiry) qs.set('expiry', optSelectedExpiry);
          const res = await fetch(`/api/lse/options/chain?${qs.toString()}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to load LSE options chain');
          if (!cancelled) {
            const expiries = Array.isArray(data.expiries) ? data.expiries : [];
            setOptChainData({
              underlyingPrice: data.underlyingPrice ?? null,
              expiries,
              contracts: Array.isArray(data.contracts) ? data.contracts : [],
            });
          }
        } else {
          const qs = new URLSearchParams({ limit: '60' });
          if (!optFlowAllMarket && optUnderlying) qs.set('underlying', optUnderlying);
          if (optMinPremium > 0) qs.set('min_premium', String(optMinPremium));
          const res = await fetch(`/api/lse/options/flow?${qs.toString()}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'Failed to load LSE options flow');
          if (!cancelled) {
            setOptFlowPrints(Array.isArray(data.prints) ? data.prints : []);
          }
        }
      } catch (err) {
        if (!cancelled) setOptionsError((err as Error).message || 'Options request failed');
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    panelOpen,
    activeTab,
    optSubTab,
    optUnderlying,
    optContractType,
    optSelectedExpiry,
    optFlowAllMarket,
    optMinPremium,
  ]);
  const topEconomicEvent = economicEvents[0] || null;

  const displayedWatchlist = watchlistSymbols
    .map((symKey) => symbols.find((s) => s.symbol === symKey))
    .filter((s): s is SymbolInfo => Boolean(s))
    .filter((s) => (watchlistFilter === 'flagged' ? Boolean(s.flagColor) : true));

  const activeAlertsCount = alerts.filter((a) => a.active).length;

  const handleDownloadWatchlistCsv = () => {
    const header = 'Symbol,Name,Exchange,Market,Last,Change,ChangePct,Volume\n';
    const rows = displayedWatchlist
      .map(
        (s) =>
          `${s.symbol},"${s.name}",${s.exchange},${s.lseMarket},${s.price},${s.change},${s.changePercent}%,${s.volume24h}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchlist_lse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setWatchlistMenuOpen(false);
  };

  const handleEstimateExport = async () => {
    setEstimating(true);
    setEstimateResult(null);
    try {
      const qs = new URLSearchParams({
        market: selectedSymbolObj.lseMarket,
        symbol: selectedSymbolObj.lseHttpSymbol,
        timeframe: expTf,
        from: expFrom,
        to: expTo,
      });
      const res = await fetch(`/api/lse/estimate?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Estimate failed');
      setEstimateResult({
        rows: data.estimated_rows ?? data.rows ?? 0,
        bytes: data.estimated_bytes ?? data.bytes ?? 0,
      });
    } catch (err) {
      setEstimateResult({ error: (err as Error).message });
    } finally {
      setEstimating(false);
    }
  };

  const handleDownloadLseCsv = () => {
    const qs = new URLSearchParams({
      market: selectedSymbolObj.lseMarket,
      symbol: selectedSymbolObj.lseHttpSymbol,
      timeframe: expTf,
      from: expFrom,
      to: expTo,
      adjusted: '1',
    });
    const a = document.createElement('a');
    a.href = `/api/lse/export?${qs.toString()}`;
    a.download = `${selectedSymbolObj.lseHttpSymbol}_${expTf}.csv`;
    a.click();
  };

  return (
    <div className="flex h-full shrink-0 select-none z-30">
      {/* Main Right Sidebar Content Area (244px slim layout, collapsible via rail toggle) */}
      {panelOpen && (
      <aside
        aria-label="Watchlist and Symbol Details"
        className="fixed md:static top-[34px] bottom-0 right-[38px] md:top-auto md:bottom-auto md:right-auto z-40 w-[min(82vw,280px)] md:w-[268px] tv-glass-panel border-l flex flex-col md:h-full overflow-hidden pb-[env(safe-area-inset-bottom)] shadow-2xl md:shadow-none"
      >
        {activeTab === 'watchlist' && (
          <>
            {/* Top Half: Watchlist */}
            <div
              className={`flex flex-col ${
                detailsExpanded ? 'h-[204px]' : 'flex-1'
              } border-b border-[var(--tv-border)] shrink-0`}
            >
              {/* Watchlist Header Bar */}
              <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)] shrink-0 relative">
                <button
                  type="button"
                  onClick={() => setWatchlistFilter((f) => (f === 'all' ? 'flagged' : 'all'))}
                  aria-label="Filter Watchlist"
                  className="flex items-center gap-1 text-[12px] font-semibold text-[var(--tv-text)] hover:opacity-80 cursor-pointer"
                >
                  <span>{watchlistFilter === 'all' ? 'Watchlist' : 'Flagged List'}</span>
                  <span className="text-[9px] text-[var(--tv-text-muted)]">▼</span>
                </button>

                <div className="flex items-center gap-0.5 text-[var(--tv-text-secondary)]" ref={watchlistMenuRef}>
                  <button
                    type="button"
                    onClick={onOpenAddSymbol}
                    aria-label="Add Symbol to Watchlist"
                    title="Add LSE Symbol to Watchlist"
                    className="w-5 h-5 rounded hover:bg-[var(--tv-bg-hover)] flex items-center justify-center hover:text-[var(--tv-text)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailsExpanded((v) => !v)}
                    aria-label="Toggle Symbol Details Pane"
                    title="Expand / Collapse Watchlist"
                    className="w-5 h-5 rounded hover:bg-[var(--tv-bg-hover)] flex items-center justify-center hover:text-[var(--tv-text)] transition-colors"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchlistMenuOpen((v) => !v)}
                    aria-label="Watchlist Options"
                    title="Watchlist Options"
                    className="w-5 h-5 rounded hover:bg-[var(--tv-bg-hover)] flex items-center justify-center hover:text-[var(--tv-text)] transition-colors"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>

                  {watchlistMenuOpen && (
                    <div className="absolute right-2 top-[30px] w-44 tv-glass-popover border rounded-lg py-1 z-50 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          onRefreshQuotes();
                          setWatchlistMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Refresh LSE Quotes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWatchlistFilter((f) => (f === 'all' ? 'flagged' : 'all'));
                          setWatchlistMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]"
                      >
                        <Bookmark className="w-3 h-3" />
                        <span>{watchlistFilter === 'all' ? 'Show Flagged Only' : 'Show All Symbols'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadWatchlistCsv}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export Watchlist CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Watchlist Column Headers */}
              <div className="h-[22px] px-1.5 flex items-center text-[10.5px] text-[var(--tv-text-muted)] border-b border-[var(--tv-border)] shrink-0">
                <div className="w-3 flex items-center justify-center mr-1 shrink-0">
                  <span className="w-2 h-1.5 bg-[var(--tv-border)] inline-block rounded-xs" />
                </div>
                <div className="w-[88px] text-left shrink-0">Symb</div>
                <div className="flex-1 text-right pr-1.5">Last</div>
                <div className="w-[46px] text-right pr-1">Chg</div>
                <div className="w-[44px] text-right pr-0.5">Chg%</div>
              </div>

              {/* Watchlist Rows */}
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--tv-border)]">
                {displayedWatchlist.map((item) => {
                  const isSelected = item.symbol === activeSymbol;
                  const isNegative = item.change < 0;
                  const justTicked = lastTickSymbol === item.symbol;

                  return (
                    <div
                      key={item.symbol}
                      onClick={() => onSelectSymbol(item.symbol)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select symbol ${item.symbol}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectSymbol(item.symbol);
                        }
                      }}
                      className={`group relative h-[28px] px-1.5 flex items-center text-[10.5px] cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--tv-bg-active)] border-y border-[var(--tv-border)]'
                          : 'hover:bg-[var(--tv-bg-hover)]'
                      }`}
                    >
                      {/* Left Ribbon Flag */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onToggleSymbolFlag(item.symbol);
                        }}
                        aria-label={`Flag ${item.symbol}`}
                        className="w-3 h-3.5 flex items-center justify-center mr-1 shrink-0"
                      >
                        <svg
                          viewBox="0 0 12 10"
                          className={`w-2 h-2 ${
                            item.flagColor === 'red'
                              ? 'text-[#f23645] fill-current'
                              : item.flagColor === 'orange'
                              ? 'text-[#ff9800] fill-current'
                              : item.flagColor === 'blue'
                              ? 'text-[#2962ff] fill-current'
                              : 'text-[var(--tv-border)] group-hover:text-[var(--tv-text-muted)]'
                          }`}
                        >
                          <path d="M0 0 H10 L12 5 L10 10 H0 L2 5 Z" />
                        </svg>
                      </button>

                      {/* Circular Instrument Badge + Symbol Code */}
                      <div className="w-[88px] flex items-center gap-1 min-w-0 shrink-0 pr-1">
                        <span
                          style={{
                            backgroundColor: item.badgeBg,
                            color: item.badgeColor || '#ffffff',
                          }}
                          className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7.5px] font-extrabold leading-none shrink-0"
                        >
                          {item.badgeText}
                        </span>
                        <span className="font-semibold text-[10.5px] text-[var(--tv-text)] truncate flex items-center gap-0.5">
                          {item.symbol}
                          <span
                            className={`text-[6px] align-top ${
                              item.dataSource === 'lse-live' ? 'text-[#089981]' : 'text-[#ff9800]'
                            }`}
                          >
                            ●
                          </span>
                        </span>
                      </div>

                      {/* Last Price */}
                      <div
                        className={`flex-1 text-right font-mono tabular-nums pr-1.5 ${
                          item.price <= 0
                            ? 'text-[var(--tv-text-muted)]'
                            : justTicked
                            ? isNegative
                              ? 'text-[#ff5252] font-semibold'
                              : 'text-[#00e676] font-semibold'
                            : isNegative
                            ? 'text-[#f23645]'
                            : 'text-[#089981]'
                        }`}
                      >
                        {item.price > 0
                          ? formatPrice(item.price, item.decimals >= 4 ? 4 : item.decimals)
                          : '—'}
                      </div>

                      {/* Change */}
                      <div
                        className={`w-[46px] text-right font-mono tabular-nums pr-1 truncate ${
                          item.price <= 0
                            ? 'text-[var(--tv-text-muted)]'
                            : isNegative
                            ? 'text-[#f23645]'
                            : 'text-[#089981]'
                        }`}
                      >
                        {item.price > 0
                          ? formatPrice(
                              item.change,
                              item.decimals >= 4 ? 4 : item.symbol === 'BTCUSDT' ? 0 : item.decimals
                            )
                          : '—'}
                      </div>

                      {/* Change % */}
                      <div
                        className={`w-[44px] text-right font-mono tabular-nums pr-0.5 ${
                          item.price <= 0
                            ? 'text-[var(--tv-text-muted)]'
                            : isNegative
                            ? 'text-[#f23645]'
                            : 'text-[#089981]'
                        }`}
                      >
                        {item.price > 0 ? `${item.changePercent.toFixed(2)}%` : '—'}
                      </div>

                      {/* Hover Delete Trash Button */}
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onRemoveFromWatchlist(item.symbol);
                        }}
                        aria-label={`Remove ${item.symbol} from watchlist`}
                        className="hidden group-hover:flex absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-bear)] items-center justify-center shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Half: Selected Symbol Details + Economic Calendar Card + Forward Curve */}
            {detailsExpanded && (
              <div className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-2">
                {/* Symbol Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{
                        backgroundColor: selectedSymbolObj.badgeBg,
                        color: selectedSymbolObj.badgeColor || '#ffffff',
                      }}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[8.5px] font-extrabold"
                    >
                      {selectedSymbolObj.badgeText}
                    </span>
                    <span className="text-[13px] font-bold text-[var(--tv-text)]">
                      {selectedSymbolObj.symbol}
                    </span>
                    <span
                      className={`text-[7px] ${
                        selectedSymbolObj.dataSource === 'lse-live'
                          ? 'text-[#089981]'
                          : 'text-[#ff9800]'
                      }`}
                    >
                      ●
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 text-[var(--tv-text-muted)]">
                    <button
                      type="button"
                      onClick={() => onSelectTab('object_tree')}
                      aria-label="View Data Window"
                      title="Object Tree & Indicators"
                      className="p-0.5 hover:text-[var(--tv-text)] rounded hover:bg-[var(--tv-bg-hover)]"
                    >
                      <LayoutGrid className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={onOpenCreateAlert}
                      aria-label="Add Symbol Note or Alert"
                      title="Create Price Alert"
                      className="p-0.5 hover:text-[var(--tv-text)] rounded hover:bg-[var(--tv-bg-hover)]"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab('screener_factors')}
                      aria-label="Symbol Fundamentals and Details"
                      title="View LSE Fundamentals & History"
                      className="p-0.5 hover:text-[var(--tv-text)] rounded hover:bg-[var(--tv-bg-hover)]"
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Full Instrument Name & Exchange Subtitle */}
                <div className="text-[11px] text-[var(--tv-text-muted)] leading-snug -mt-0.5">
                  <div className="flex items-center gap-1 text-[var(--tv-text-secondary)] truncate">
                    <span className="truncate">{selectedSymbolObj.name}</span>
                    <ExternalLink className="w-2.5 h-2.5 inline text-[var(--tv-text-muted)] shrink-0" />
                    <span className="shrink-0">· {selectedSymbolObj.exchange}</span>
                  </div>
                  <div className="text-[var(--tv-text-muted)] text-[10.5px]">
                    {selectedSymbolObj.type} · {selectedSymbolObj.lseMarket} ({selectedSymbolObj.lseHttpSymbol})
                  </div>
                </div>

                {/* Big Price Readout */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      data-testid="details-live-price"
                      className={`text-[21px] font-bold font-mono tracking-tight tabular-nums leading-none ${
                        selectedSymbolObj.price <= 0
                          ? 'text-[var(--tv-text-muted)]'
                          : selectedSymbolObj.change < 0
                          ? 'text-[#f23645]'
                          : 'text-[#089981]'
                      }`}
                    >
                      {selectedSymbolObj.price > 0
                        ? formatPrice(selectedSymbolObj.price, selectedSymbolObj.decimals)
                        : '—'}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--tv-text-muted)]">
                      {selectedSymbolObj.currency}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 text-[12px] font-mono font-medium tabular-nums mt-0.5 ${
                      selectedSymbolObj.price <= 0
                        ? 'text-[var(--tv-text-muted)]'
                        : selectedSymbolObj.change < 0
                        ? 'text-[#f23645]'
                        : 'text-[#089981]'
                    }`}
                  >
                    <span>
                      {selectedSymbolObj.price > 0
                        ? `${selectedSymbolObj.change > 0 ? '+' : ''}${formatPrice(
                            selectedSymbolObj.change,
                            selectedSymbolObj.decimals
                          )}`
                        : '—'}
                    </span>
                    <span>
                      {selectedSymbolObj.price > 0
                        ? `${selectedSymbolObj.changePercent > 0 ? '+' : ''}${selectedSymbolObj.changePercent.toFixed(2)}%`
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#089981] mt-0.5">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
                      <span>
                        {selectedSymbolObj.dataSource === 'lse-live'
                          ? 'LSE WS Live'
                          : 'LSE Market Feed'}
                      </span>
                    </div>
                    <span className="text-[var(--tv-text-muted)] font-mono">
                      H {selectedSymbolObj.dayHigh > 0 ? formatPrice(selectedSymbolObj.dayHigh, selectedSymbolObj.decimals) : '—'}
                    </span>
                  </div>
                </div>

                {/* Economic Calendar / Macro Card */}
                <div
                  onClick={() => onSelectTab('news_calendar')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectTab('news_calendar');
                  }}
                  className="bg-[#9c27b0]/12 hover:bg-[#9c27b0]/18 border border-[#9c27b0]/30 rounded-md p-2 transition-colors cursor-pointer"
                >
                  <div className="text-[10.5px] text-[var(--tv-text-muted)] mb-0.5 flex items-center justify-between">
                    <span>
                      <span className="text-[#a855f7] font-semibold">Calendar</span> ·{' '}
                      {topEconomicEvent
                        ? `${topEconomicEvent.region_code} · ${topEconomicEvent.date}`
                        : 'LSE Macro Wire'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--tv-text)] leading-snug line-clamp-2">
                    {topEconomicEvent
                      ? topEconomicEvent.event
                      : 'Loading LSE economic calendar releases...'}
                  </p>
                  {topEconomicEvent && (
                    <div className="text-[10px] font-mono text-[var(--tv-text-secondary)] mt-1 flex gap-2">
                      {topEconomicEvent.actual !== null && topEconomicEvent.actual !== undefined && (
                        <span>Act: {topEconomicEvent.actual}</span>
                      )}
                      {topEconomicEvent.forecast !== null && topEconomicEvent.forecast !== undefined && (
                        <span>Est: {topEconomicEvent.forecast}</span>
                      )}
                      {topEconomicEvent.previous !== null && topEconomicEvent.previous !== undefined && (
                        <span>Prev: {topEconomicEvent.previous}</span>
                      )}
                    </div>
                  )}
                  <div className="text-[10.5px] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] mt-1 flex items-center gap-0.5">
                    <span>Economic events</span>
                    <span>›</span>
                  </div>
                </div>

                {/* Real LSE Session Summary Metrics */}
                <div className="pt-0.5">
                  <div className="text-[11px] font-semibold text-[var(--tv-text)] mb-1.5">
                    Session Summary
                  </div>
                  <div className="tv-glass-card border rounded p-2 grid grid-cols-2 gap-y-1.5 gap-x-2 text-[10.5px] font-mono tabular-nums">
                    <div>
                      <div className="text-[9.5px] text-[var(--tv-text-muted)]">Open</div>
                      <div className="text-[var(--tv-text)]">
                        {selectedSymbolObj.dayOpen > 0
                          ? formatPrice(selectedSymbolObj.dayOpen, selectedSymbolObj.decimals)
                          : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] text-[var(--tv-text-muted)]">Volume</div>
                      <div className="text-[var(--tv-text)]">
                        {selectedSymbolObj.volume24h > 0
                          ? Math.round(selectedSymbolObj.volume24h).toLocaleString()
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9.5px] text-[var(--tv-text-muted)]">Day High</div>
                      <div className="text-[#089981]">
                        {selectedSymbolObj.dayHigh > 0
                          ? formatPrice(selectedSymbolObj.dayHigh, selectedSymbolObj.decimals)
                          : '—'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9.5px] text-[var(--tv-text-muted)]">Day Low</div>
                      <div className="text-[#f23645]">
                        {selectedSymbolObj.dayLow > 0
                          ? formatPrice(selectedSymbolObj.dayLow, selectedSymbolObj.decimals)
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Price Alerts Panel */}
        {activeTab === 'alerts' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">
                Price Alerts ({alerts.length})
              </span>
              <button
                type="button"
                onClick={onOpenCreateAlert}
                aria-label="Add New Alert"
                className="px-2 py-0.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[11px] font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Create</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--tv-text-muted)]">
                  No active alerts. Click Create to monitor live LSE ticks.
                </div>
              ) : (
                alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded tv-glass-card border flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--tv-text)]">
                        <span>{al.symbol}</span>
                        <span className="text-[var(--tv-text-secondary)] font-normal">{al.condition}</span>
                        <span className="font-mono text-[#f59e0b] tabular-nums">
                          {formatPrice(al.targetPrice, 2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--tv-text-muted)] mt-0.5">{al.note}</div>
                      <div className="text-[10px] mt-1">
                        {al.triggered ? (
                          <span className="text-[#089981] font-semibold">
                            ● Triggered at {al.triggeredAt}
                          </span>
                        ) : (
                          <span className="text-[var(--tv-accent)]">● Active · Monitoring live LSE feed</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAlert(al.id)}
                      aria-label={`Delete alert on ${al.symbol}`}
                      className="text-[var(--tv-text-muted)] hover:text-[#f23645] p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Object Tree & Indicators Manager */}
        {activeTab === 'object_tree' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">Object Tree & Layers</span>
              <span className="text-[10.5px] text-[var(--tv-text-muted)]">{activeSymbol}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
              <div>
                <div className="text-[11px] font-semibold text-[var(--tv-text-secondary)] uppercase tracking-wider mb-1.5">
                  Active Studies & Indicators
                </div>
                <div className="space-y-1">
                  {indicators.filter((ind) => !ind.removed).length === 0 ? (
                    <p className="text-xs text-[var(--tv-text-muted)]">
                      All indicators removed. Open Indicators in the top toolbar to re-add.
                    </p>
                  ) : (
                    indicators
                      .filter((ind) => !ind.removed)
                      .map((ind) => (
                        <div
                          key={ind.id}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded tv-glass-card border text-xs"
                        >
                          <span
                            className={`truncate ${
                              ind.visible ? 'text-[var(--tv-text)]' : 'text-[var(--tv-text-muted)] line-through'
                            }`}
                          >
                            {ind.name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleIndicator(ind.id)}
                              className="text-[11px] text-[var(--tv-accent)] hover:underline"
                            >
                              {ind.visible ? 'Hide' : 'Show'}
                            </button>
                            {onRemoveIndicator && (
                              <button
                                type="button"
                                onClick={() => onRemoveIndicator(ind.id)}
                                aria-label={`Delete ${ind.name} indicator`}
                                title={`Delete ${ind.name} from chart`}
                                className="text-[var(--tv-text-muted)] hover:text-[#f23645] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[var(--tv-text-secondary)] uppercase tracking-wider mb-1.5">
                  Chart Drawings ({drawings.length})
                </div>
                {drawings.length === 0 ? (
                  <p className="text-xs text-[var(--tv-text-muted)]">
                    Select any tool from the left or floating toolbar and click on the chart to draw.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {drawings.map((d) => {
                      const isSel = d.id === selectedDrawingId;
                      return (
                        <div
                          key={d.id}
                          onClick={() => onSelectDrawing(isSel ? null : d.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              onSelectDrawing(isSel ? null : d.id);
                            }
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors border ${
                            isSel
                              ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)]'
                              : 'tv-glass-card hover:bg-[var(--tv-bg-hover)]'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div
                              className={`font-medium truncate flex items-center gap-1.5 ${
                                d.visible === false ? 'text-[var(--tv-text-muted)] line-through' : 'text-[var(--tv-text)]'
                              }`}
                            >
                              <span
                                style={{ backgroundColor: d.color }}
                                className="w-2 h-2 rounded-full shrink-0"
                              />
                              <span className="truncate">{d.text || d.tool}</span>
                            </div>
                            <div className="text-[10.5px] font-mono text-[var(--tv-text-muted)] tabular-nums">
                              {d.symbol} @ {formatPrice(d.p1, 2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onUpdateDrawing({ ...d, locked: !d.locked });
                              }}
                              aria-label={`${d.locked ? 'Unlock' : 'Lock'} drawing ${d.tool}`}
                              className={`p-0.5 ${
                                d.locked ? 'text-[var(--tv-accent)]' : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                              }`}
                            >
                              {d.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onUpdateDrawing({ ...d, visible: d.visible === false });
                              }}
                              aria-label={`${d.visible === false ? 'Show' : 'Hide'} drawing ${d.tool}`}
                              className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] p-0.5"
                            >
                              {d.visible === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onRemoveDrawing(d.id);
                              }}
                              aria-label={`Remove drawing ${d.tool}`}
                              className="text-[var(--tv-text-muted)] hover:text-[#f23645] p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: DOM Order Ticket & Active Positions */}
        {activeTab === 'dom_trade' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">Order DOM · {activeSymbol}</span>
              <span className="text-[10.5px] font-mono text-[#089981]">LIVE</span>
            </div>
            <div className="p-2 space-y-2.5 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <label className="block text-[10px] text-[var(--tv-text-muted)] mb-0.5">Qty / Contracts</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={orderQty}
                    onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    aria-label="Order Quantity"
                    className="w-full h-7 px-2 rounded tv-glass-input border font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--tv-text-muted)] mb-0.5">Stop Loss</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={orderSl}
                    onChange={(e) => setOrderSl(e.target.value)}
                    aria-label="Stop Loss Price"
                    className="w-full h-7 px-1.5 rounded tv-glass-input border font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--tv-text-muted)] mb-0.5">Take Profit</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={orderTp}
                    onChange={(e) => setOrderTp(e.target.value)}
                    aria-label="Take Profit Price"
                    className="w-full h-7 px-1.5 rounded tv-glass-input border font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={selectedSymbolObj.price <= 0}
                  onClick={() =>
                    onQuickOrder(
                      'SELL',
                      orderQty,
                      parseFloat(orderSl) || undefined,
                      parseFloat(orderTp) || undefined
                    )
                  }
                  className="py-2 px-2.5 rounded bg-[#f23645]/15 border border-[#f23645] text-[#f23645] hover:bg-[#f23645] hover:text-white transition-colors disabled:opacity-50 flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold uppercase">Sell {orderQty} Mkt</span>
                  <span className="text-sm font-mono font-bold tabular-nums">
                    {selectedSymbolObj.bid > 0
                      ? formatPrice(selectedSymbolObj.bid, selectedSymbolObj.decimals)
                      : '—'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={selectedSymbolObj.price <= 0}
                  onClick={() =>
                    onQuickOrder(
                      'BUY',
                      orderQty,
                      parseFloat(orderSl) || undefined,
                      parseFloat(orderTp) || undefined
                    )
                  }
                  className="py-2 px-2.5 rounded bg-[#2962ff]/15 border border-[#2962ff] text-[#2962ff] hover:bg-[#2962ff] hover:text-white transition-colors disabled:opacity-50 flex flex-col items-center"
                >
                  <span className="text-[10px] font-bold uppercase">Buy {orderQty} Mkt</span>
                  <span className="text-sm font-mono font-bold tabular-nums">
                    {selectedSymbolObj.ask > 0
                      ? formatPrice(selectedSymbolObj.ask, selectedSymbolObj.decimals)
                      : '—'}
                  </span>
                </button>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-[var(--tv-text-secondary)] uppercase tracking-wider mb-1.5">
                  Open Positions ({positions.length})
                </div>
                {positions.length === 0 ? (
                  <div className="text-xs text-[var(--tv-text-muted)] py-4 text-center border border-dashed border-[var(--tv-border)] rounded">
                    No open positions. Click BUY or SELL above or on chart.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {positions.map((pos) => {
                      const symObj = symbols.find((s) => s.symbol === pos.symbol) || selectedSymbolObj;
                      const pnl = calculatePositionPnL(pos, symObj.price);
                      return (
                        <div
                          key={pos.id}
                          className="p-2 rounded tv-glass-card border flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-semibold text-[var(--tv-text)]">
                              <span
                                className={
                                  pos.side === 'BUY' ? 'text-[#2962ff]' : 'text-[#f23645]'
                                }
                              >
                                {pos.side}
                              </span>{' '}
                              {pos.qty} {pos.symbol}
                            </div>
                            <div className="text-[10.5px] font-mono text-[var(--tv-text-muted)] tabular-nums">
                              Entry: {formatPrice(pos.entryPrice, symObj.decimals)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-mono font-semibold tabular-nums ${
                                pnl.dollarPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'
                              }`}
                            >
                              {pnl.dollarPnL >= 0 ? '+' : ''}${pnl.dollarPnL.toFixed(2)}
                            </div>
                            <button
                              type="button"
                              onClick={() => onClosePosition(pos.id)}
                              className="text-[10px] text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] underline"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Real LSE Economic Calendar & Macro Wire */}
        {activeTab === 'news_calendar' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">Economic Calendar</span>
              <button
                type="button"
                onClick={() => onSelectTab('watchlist')}
                className="text-[11px] text-[var(--tv-accent)] hover:underline"
              >
                Watchlist
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {economicEvents.length === 0 ? (
                <div className="text-xs text-[var(--tv-text-muted)] py-6 text-center">
                  Loading LSE economic calendar releases...
                </div>
              ) : (
                economicEvents.map((ev) => (
                  <div
                    key={String(ev.id)}
                    className="p-2 rounded tv-glass-card border space-y-1"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--tv-accent-soft)] text-[var(--tv-accent)] font-bold">
                        {ev.region_code}
                      </span>
                      <span className="font-mono text-[var(--tv-text-muted)]">
                        {ev.date} {ev.time || ''}
                      </span>
                    </div>
                    <div className="text-[11.5px] font-medium text-[var(--tv-text)] leading-snug">
                      {ev.event}
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] font-mono text-[var(--tv-text-secondary)]">
                      <span>Act: {ev.actual ?? '—'}</span>
                      <span>Est: {ev.forecast ?? ev.consensus ?? '—'}</span>
                      <span>Prev: {ev.previous ?? '—'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 6: LSE Fundamentals, History & Corporate Factors */}
        {activeTab === 'screener_factors' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)] truncate">
                Fundamentals · {selectedSymbolObj.symbol}
              </span>
              <button
                type="button"
                onClick={() => onSelectTab('watchlist')}
                className="text-[11px] text-[var(--tv-accent)] hover:underline shrink-0"
              >
                Back
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
              {loadingDetails ? (
                <div className="py-8 text-center text-[var(--tv-text-secondary)]">
                  Fetching LSE overview, factors & profile...
                </div>
              ) : symbolDetails ? (
                <>
                  {symbolDetails.history && (
                    <div className="p-2 rounded tv-glass-card border space-y-1">
                      <div className="text-[10.5px] font-semibold text-[var(--tv-text-secondary)] uppercase">
                        LSE Dataset Coverage
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--tv-text-muted)]">Market / Key</span>
                        <span className="font-mono text-[var(--tv-text)]">
                          {symbolDetails.market} / {symbolDetails.httpSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--tv-text-muted)]">First Bar</span>
                        <span className="font-mono text-[var(--tv-text-secondary)]">
                          {symbolDetails.history.first?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--tv-text-muted)]">Latest Bar</span>
                        <span className="font-mono text-[#089981]">
                          {symbolDetails.history.last?.slice(0, 16)}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--tv-text-muted)]">Stored 1m Rows</span>
                        <span className="font-mono text-[var(--tv-text)]">
                          {symbolDetails.history.rows?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  {symbolDetails.profile && (
                    <div className="p-2 rounded tv-glass-card border space-y-1.5">
                      <div className="text-[10.5px] font-semibold text-[var(--tv-text-secondary)] uppercase">
                        Company Profile
                      </div>
                      <div className="font-semibold text-[var(--tv-text)]">
                        {symbolDetails.profile.company_name}
                      </div>
                      <div className="text-[11px] text-[var(--tv-text-secondary)]">
                        {symbolDetails.profile.sector} · {symbolDetails.profile.industry}
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[10.5px] font-mono pt-1">
                        <span className="text-[var(--tv-text-muted)]">CEO:</span>
                        <span className="text-right text-[var(--tv-text)] truncate">
                          {symbolDetails.profile.ceo || '—'}
                        </span>
                        <span className="text-[var(--tv-text-muted)]">Beta:</span>
                        <span className="text-right text-[var(--tv-text)]">
                          {symbolDetails.profile.beta ?? '—'}
                        </span>
                        <span className="text-[var(--tv-text-muted)]">Mkt Cap:</span>
                        <span className="text-right text-[var(--tv-text)]">
                          {symbolDetails.profile.market_cap
                            ? `$${(symbolDetails.profile.market_cap / 1e9).toFixed(1)}B`
                            : '—'}
                        </span>
                      </div>
                      {symbolDetails.profile.description && (
                        <p className="text-[10.5px] text-[var(--tv-text-muted)] leading-relaxed line-clamp-4 pt-1">
                          {symbolDetails.profile.description}
                        </p>
                      )}
                    </div>
                  )}

                  {symbolDetails.factors && (
                    <div className="p-2 rounded tv-glass-card border space-y-1.5">
                      <div className="text-[10.5px] font-semibold text-[var(--tv-text-secondary)] uppercase">
                        Corporate Actions ({symbolDetails.factors.dividendsCount} divs)
                      </div>
                      {symbolDetails.factors.recentDividends.length === 0 ? (
                        <div className="text-[11px] text-[var(--tv-text-muted)]">
                          No dividend records on this contract.
                        </div>
                      ) : (
                        symbolDetails.factors.recentDividends.slice(0, 5).map((d, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] font-mono">
                            <span className="text-[var(--tv-text-secondary)]">{d.ex_date || '—'}</span>
                            <span className="text-[#089981]">
                              ${Number(d.amount || 0).toFixed(3)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-6 text-center text-[var(--tv-text-muted)]">
                  No overview returned for this symbol.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Macro & Sovereign Bond Yields */}
        {activeTab === 'macro_yields' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">Sovereign Bond Yields</span>
              <span className="text-[10px] font-mono text-[#089981]">LSE MACRO</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {bondYields.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--tv-text-muted)]">
                  Loading sovereign yield curve...
                </div>
              ) : (
                bondYields.map((y) => (
                  <div
                    key={y.symbol}
                    className="px-2 py-1.5 rounded tv-glass-card border flex items-center justify-between text-[11px]"
                  >
                    <div>
                      <div className="font-semibold text-[var(--tv-text)]">
                        {y.country_iso2} {y.maturity}
                      </div>
                      <div className="text-[10px] text-[var(--tv-text-muted)]">{y.country_name}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-[var(--tv-accent)] font-bold">{Number(y.close).toFixed(3)}%</div>
                      <div className="text-[9.5px] text-[var(--tv-text-muted)]">{y.date}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 8: Live WebSocket Tick Tape */}
        {activeTab === 'tape' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">Live LSE Tick Tape</span>
              <span className="text-[10px] font-mono text-[#089981]">{tickTape.length} ticks</span>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 font-mono text-[10.5px]">
              {tickTape.length === 0 ? (
                <div className="py-8 px-2 text-center font-sans text-xs text-[var(--tv-text-muted)]">
                  Waiting for incoming WebSocket ticks from data-ws / london-ws (active symbols like BTCUSDT stream 24/7).
                </div>
              ) : (
                tickTape.map((tk) => (
                  <div
                    key={tk.id}
                    onClick={() => onSelectSymbol(tk.symbol)}
                    className="px-2 py-1 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <span className="font-bold text-[var(--tv-text)]">{tk.symbol}</span>
                      <span className="text-[9px] text-[var(--tv-text-muted)] ml-1.5">{tk.sourceSocket}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[#089981] font-semibold">{tk.price}</div>
                      <div className="text-[9px] text-[var(--tv-text-muted)]">
                        {new Date(tk.ts).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 9: LSE Historical CSV Estimator & Exporter */}
        {activeTab === 'export_tools' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)]">
              <span className="text-[12px] font-semibold text-[var(--tv-text)]">LSE CSV Exporter</span>
              <span className="text-[10px] font-mono text-[var(--tv-text-muted)]">/v3/export</span>
            </div>
            <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 text-xs">
              <div className="p-2 rounded tv-glass-card border">
                <div className="text-[10.5px] text-[var(--tv-text-muted)]">Target Instrument</div>
                <div className="font-bold text-[var(--tv-text)]">
                  {selectedSymbolObj.symbol} ({selectedSymbolObj.lseMarket}:{selectedSymbolObj.lseHttpSymbol})
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] text-[var(--tv-text-secondary)] mb-1">Timeframe</label>
                <select
                  value={expTf}
                  onChange={(e) => setExpTf(e.target.value)}
                  className="w-full h-8 px-2 rounded tv-glass-input border"
                >
                  {['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1mo'].map((tf) => (
                    <option key={tf} value={tf}>
                      {tf} (active chart: {activeTimeframe})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-[10.5px] text-[var(--tv-text-secondary)] mb-1">From</label>
                  <input
                    type="date"
                    value={expFrom}
                    onChange={(e) => setExpFrom(e.target.value)}
                    className="w-full h-8 px-1.5 rounded tv-glass-input border font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] text-[var(--tv-text-secondary)] mb-1">To</label>
                  <input
                    type="date"
                    value={expTo}
                    onChange={(e) => setExpTo(e.target.value)}
                    className="w-full h-8 px-1.5 rounded tv-glass-input border font-mono text-[11px]"
                  />
                </div>
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleEstimateExport}
                  disabled={estimating}
                  className="flex-1 h-8 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text)] font-medium"
                >
                  {estimating ? 'Estimating...' : 'Estimate Rows'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadLseCsv}
                  className="flex-1 h-8 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] font-semibold flex items-center justify-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
              </div>

              {estimateResult && (
                <div className="p-2 rounded tv-glass-card border font-mono text-[11px]">
                  {estimateResult.error ? (
                    <span className="text-[#f23645]">{estimateResult.error}</span>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-[var(--tv-text-muted)]">Est. Rows:</span>
                        <span className="text-[var(--tv-text)]">{estimateResult.rows?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--tv-text-muted)]">Est. Size:</span>
                        <span className="text-[#089981]">
                          {((estimateResult.bytes || 0) / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 10: Real LSE US Options Chain & Unusual Flow */}
        {activeTab === 'options' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="h-[32px] px-2.5 flex items-center justify-between border-b border-[var(--tv-border)] shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--tv-text)]">US Options</span>
                <span className="text-[9.5px] px-1 py-0.5 rounded bg-[var(--tv-accent-soft)] text-[var(--tv-accent)] font-mono font-semibold">
                  OPRA
                </span>
              </div>
              {optChainData?.underlyingPrice ? (
                <span className="text-[11px] font-mono text-[#089981] tabular-nums">
                  {optUnderlying} ${Number(optChainData.underlyingPrice).toFixed(2)}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[var(--tv-text-muted)]">{optUnderlying}</span>
              )}
            </div>

            {/* Underlying Search + Quick Chips + Chain/Flow Switch */}
            <div className="p-2 border-b border-[var(--tv-border)] space-y-1.5 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = optDraftTicker.trim().toUpperCase();
                  if (clean) {
                    setOptUnderlying(clean);
                    setOptSelectedExpiry('');
                  }
                }}
                className="flex items-center gap-1"
              >
                <input
                  type="text"
                  value={optDraftTicker}
                  onChange={(e) => setOptDraftTicker(e.target.value.toUpperCase())}
                  placeholder="Underlying (AAPL, SPY, NVDA...)"
                  aria-label="Options Underlying Ticker"
                  className="flex-1 h-7 px-2 rounded tv-glass-input border text-[11px] font-mono focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <button
                  type="submit"
                  className="h-7 px-2.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[11px] font-semibold"
                >
                  Load
                </button>
              </form>

              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {['AAPL', 'NVDA', 'SPY', 'QQQ', 'TSLA', 'AMZN', 'MSFT', 'META'].map((tk) => (
                  <button
                    key={tk}
                    type="button"
                    onClick={() => {
                      setOptDraftTicker(tk);
                      setOptUnderlying(tk);
                      setOptSelectedExpiry('');
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                      optUnderlying === tk
                        ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                        : 'tv-glass-card text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
                    }`}
                  >
                    {tk}
                  </button>
                ))}
              </div>

              {onOpenGexDashboard && (
                <button
                  type="button"
                  onClick={() => onOpenGexDashboard(optUnderlying || 'SPY')}
                  className="w-full h-7 rounded border border-[var(--tv-accent-border)] bg-[var(--tv-accent-soft)] hover:opacity-90 text-[11px] font-semibold text-[var(--tv-text)] transition-opacity flex items-center justify-center gap-1.5"
                >
                  <Activity className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
                  <span>Open {optUnderlying || 'SPY'} GEX (0DTE / 1W / Monthly)</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-1 tv-glass-card border p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setOptSubTab('chain')}
                  className={`py-1 rounded text-[11px] font-medium transition-colors ${
                    optSubTab === 'chain'
                      ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)]'
                      : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                  }`}
                >
                  Option Chain
                </button>
                <button
                  type="button"
                  onClick={() => setOptSubTab('flow')}
                  className={`py-1 rounded text-[11px] font-medium transition-colors ${
                    optSubTab === 'flow'
                      ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)]'
                      : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                  }`}
                >
                  Unusual Flow
                </button>
              </div>

              {optSubTab === 'chain' ? (
                <div className="flex items-center gap-1">
                  <select
                    value={optSelectedExpiry}
                    onChange={(e) => setOptSelectedExpiry(e.target.value)}
                    aria-label="Filter Options Expiry"
                    className="flex-1 h-6 px-1.5 rounded tv-glass-input border text-[10.5px] font-mono focus:outline-none"
                  >
                    <option value="">All Expiries ({optChainData?.expiries.length || 0})</option>
                    {(optChainData?.expiries || []).map((exp) => (
                      <option key={exp} value={exp}>
                        {exp}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center tv-glass-input border rounded overflow-hidden text-[10px]">
                    {(['all', 'call', 'put'] as const).map((ct) => (
                      <button
                        key={ct}
                        type="button"
                        onClick={() => setOptContractType(ct)}
                        className={`px-1.5 py-1 uppercase font-semibold ${
                          optContractType === ct
                            ? ct === 'call'
                              ? 'bg-[#089981] text-white'
                              : ct === 'put'
                              ? 'bg-[#f23645] text-white'
                              : 'bg-[var(--tv-bg-active)] text-[var(--tv-text)]'
                            : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                        }`}
                      >
                        {ct === 'all' ? 'All' : ct === 'call' ? 'C' : 'P'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-1 text-[10.5px]">
                  <button
                    type="button"
                    onClick={() => setOptFlowAllMarket((v) => !v)}
                    className={`px-2 py-0.5 rounded border ${
                      optFlowAllMarket
                        ? 'border-[var(--tv-accent)] bg-[var(--tv-accent-soft)] text-[var(--tv-text)]'
                        : 'tv-glass-card text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
                    }`}
                  >
                    {optFlowAllMarket ? 'All Tickers' : `${optUnderlying} Only`}
                  </button>
                  <select
                    value={optMinPremium}
                    onChange={(e) => setOptMinPremium(Number(e.target.value))}
                    aria-label="Minimum Flow Premium"
                    className="h-6 px-1.5 rounded tv-glass-input border text-[10.5px] font-mono"
                  >
                    <option value={0}>All Prints</option>
                    <option value={25000}>$25k+ Prem</option>
                    <option value={100000}>$100k+ Sweep</option>
                    <option value={500000}>$500k+ Whale</option>
                  </select>
                </div>
              )}
            </div>

            {/* Contracts / Flow List */}
            <div className="flex-1 overflow-y-auto">
              {loadingOptions ? (
                <div className="py-8 text-center text-xs text-[var(--tv-text-secondary)]">
                  Querying LSE OPRA options vault...
                </div>
              ) : optionsError ? (
                <div className="p-3 text-center text-xs text-[#f23645]">{optionsError}</div>
              ) : optSubTab === 'chain' ? (
                !optChainData || optChainData.contracts.length === 0 ? (
                  <div className="py-8 px-3 text-center text-xs text-[var(--tv-text-muted)]">
                    No option contracts found for {optUnderlying}. Try AAPL, NVDA, SPY, QQQ, or TSLA.
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-[62px_46px_50px_48px_1fr] px-2 py-1 text-[9.5px] text-[var(--tv-text-muted)] border-b border-[var(--tv-border)] font-medium sticky top-0 tv-glass-panel z-10">
                      <span>Strike</span>
                      <span>Exp</span>
                      <span className="text-right">Last</span>
                      <span className="text-right">IV%</span>
                      <span className="text-right">Δ / Vol</span>
                    </div>
                    <div className="divide-y divide-[var(--tv-border)]">
                      {optChainData.contracts.map((c) => {
                        const isCall = c.contract_type === 'call';
                        const isCharted = activeSymbol === c.ticker || activeSymbol === c.occSymbol;
                        return (
                          <button
                            key={c.ticker}
                            type="button"
                            onClick={() =>
                              onSelectOptionContract?.({
                                occSymbol: c.occSymbol,
                                underlying: c.underlying,
                                strike: c.strike,
                                expiry: c.expiry,
                                contract_type: c.contract_type,
                              })
                            }
                            title={`Plot ${c.occSymbol} candlestick chart (Gamma: ${c.gamma?.toFixed(4) ?? '—'}, Theta: ${c.theta?.toFixed(3) ?? '—'})`}
                            className={`w-full grid grid-cols-[62px_46px_50px_48px_1fr] px-2 py-1.5 text-left items-center text-[10.5px] font-mono tabular-nums transition-colors ${
                              isCharted
                                ? 'bg-[var(--tv-accent-soft)]'
                                : 'hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            <span className="flex items-center gap-1 font-semibold text-[var(--tv-text)]">
                              <span
                                className={`px-1 rounded text-[9px] font-bold ${
                                  isCall
                                    ? 'bg-[#089981]/20 text-[#089981]'
                                    : 'bg-[#f23645]/20 text-[#f23645]'
                                }`}
                              >
                                {isCall ? 'C' : 'P'}
                              </span>
                              <span>{c.strike}</span>
                            </span>
                            <span className="text-[9.5px] text-[var(--tv-text-secondary)]">
                              {c.expiry.slice(5)}
                            </span>
                            <span className="text-right text-[var(--tv-text)] font-semibold">
                              ${Number(c.last_price || 0).toFixed(2)}
                            </span>
                            <span className="text-right text-[var(--tv-text-secondary)]">
                              {c.iv !== null ? `${(c.iv * 100).toFixed(0)}%` : '—'}
                            </span>
                            <span className="text-right text-[9.5px] text-[var(--tv-text-muted)]">
                              {c.delta !== null ? c.delta.toFixed(2) : '—'} ·{' '}
                              {c.volume_today >= 1000
                                ? `${(c.volume_today / 1000).toFixed(1)}k`
                                : c.volume_today}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : optFlowPrints.length === 0 ? (
                <div className="py-8 px-3 text-center text-xs text-[var(--tv-text-muted)]">
                  No unusual flow prints matched filter. Lower Min Prem or toggle All Tickers.
                </div>
              ) : (
                <div className="p-1.5 space-y-1">
                  {optFlowPrints.map((fl) => {
                    const isCall = fl.contract_type === 'call';
                    const premStr =
                      fl.premium >= 1e6
                        ? `$${(fl.premium / 1e6).toFixed(2)}M`
                        : fl.premium >= 1e3
                        ? `$${(fl.premium / 1e3).toFixed(0)}k`
                        : `$${fl.premium.toFixed(0)}`;
                    return (
                      <button
                        key={fl.id}
                        type="button"
                        onClick={() =>
                          onSelectOptionContract?.({
                            occSymbol: fl.occSymbol,
                            underlying: fl.underlying,
                            strike: fl.strike,
                            expiry: fl.expiry,
                            contract_type: fl.contract_type,
                          })
                        }
                        className="w-full p-2 rounded tv-glass-card hover:bg-[var(--tv-bg-hover)] border text-left space-y-1 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-bold text-[var(--tv-text)] flex items-center gap-1">
                            <span>{fl.underlying}</span>
                            <span
                              className={`px-1 rounded text-[9px] ${
                                isCall
                                  ? 'bg-[#089981]/20 text-[#089981]'
                                  : 'bg-[#f23645]/20 text-[#f23645]'
                              }`}
                            >
                              ${fl.strike}
                              {isCall ? 'C' : 'P'}
                            </span>
                            <span className="text-[9.5px] text-[var(--tv-text-muted)] font-normal">
                              {fl.expiry.slice(5)}
                            </span>
                          </span>
                          <span
                            className={`font-bold ${
                              isCall ? 'text-[#089981]' : 'text-[#f23645]'
                            }`}
                          >
                            {premStr}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--tv-text-secondary)]">
                          <span>
                            {fl.volume}x @ ${Number(fl.last_price || 0).toFixed(2)}
                            {fl.iv ? ` · IV ${(fl.iv * 100).toFixed(0)}%` : ''}
                          </span>
                          <span className="text-[var(--tv-text-muted)]">
                            {fl.ts ? fl.ts.slice(11, 19) : '—'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
      )}

      {/* Far-Right Vertical Icon Rail (38px slim layout) */}
      <nav
        aria-label="Workspace Tools Rail"
        className="w-[38px] tv-glass-bar border-l flex flex-col items-center justify-between py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] shrink-0 overflow-y-auto no-scrollbar"
      >
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectTab('watchlist')}
            aria-label="Watchlist, Details and News"
            aria-pressed={panelOpen && activeTab === 'watchlist'}
            title={panelOpen && activeTab === 'watchlist' ? 'Hide Watchlist' : 'Watchlist & Symbol Details'}
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'watchlist'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Bookmark className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('alerts')}
            aria-label="Alerts Manager"
            aria-pressed={panelOpen && activeTab === 'alerts'}
            title="Price Alerts"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'alerts'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Clock className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('object_tree')}
            aria-label="Object Tree and Data Window"
            aria-pressed={panelOpen && activeTab === 'object_tree'}
            title="Object Tree & Indicators"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'object_tree'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Layers className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('options')}
            aria-label="US Options Chain and Flow"
            aria-pressed={panelOpen && activeTab === 'options'}
            title="US Options Chain & Unusual Flow (OPRA)"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'options'
                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Activity className="w-[15px] h-[15px]" />
          </button>
        </div>

        {/* Bottom Group of Right Rail Icons */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectTab('dom_trade')}
            aria-label="Order DOM and Positions"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'dom_trade'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
            title="DOM Order Ticket & Open Positions"
          >
            <Sparkles className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('screener_factors')}
            aria-label="Fundamentals and Corporate Factors"
            title="LSE Fundamentals, History & Corporate Factors"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'screener_factors'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Target className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('macro_yields')}
            aria-label="Sovereign Bond Yields and Macro"
            title="Sovereign Bond Yields & Macro Coverage"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'macro_yields'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Triangle className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('news_calendar')}
            aria-label="Economic Calendar"
            title="LSE Economic Calendar"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'news_calendar'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <Calendar className="w-[15px] h-[15px]" />
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('news_calendar')}
            aria-label="Economic Releases Wire"
            title="Live Economic Releases Wire"
            className="relative w-[28px] h-[28px] rounded-[5px] flex items-center justify-center text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors"
          >
            <Rss className="w-[15px] h-[15px]" />
            {economicEvents.length > 0 && (
              <span className="absolute top-0 right-0 bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[7.5px] font-bold leading-none px-1 py-[1px] rounded-full">
                {economicEvents.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('alerts')}
            aria-label="Notifications and Alerts"
            title="Price Alerts"
            className="relative w-[28px] h-[28px] rounded-[5px] flex items-center justify-center text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors"
          >
            <Bell className="w-[15px] h-[15px]" />
            {activeAlertsCount > 0 && (
              <span className="absolute top-0 right-0.5 bg-[#f23645] text-white text-[8px] font-bold leading-none px-1 py-[1px] rounded-full">
                {activeAlertsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectTab('tape')}
            aria-label="Live WebSocket Tick Tape"
            title="Real-Time WebSocket Tick Tape"
            className={`w-[28px] h-[28px] rounded-[5px] flex items-center justify-center transition-colors ${
              panelOpen && activeTab === 'tape'
                ? 'bg-[var(--tv-bg-active)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <MessageSquare className="w-[15px] h-[15px]" />
          </button>

          {/* Circle 9-Dot App Grid Button -> LSE CSV Estimator & Export Tools */}
          <button
            type="button"
            onClick={() => onSelectTab('export_tools')}
            aria-label="LSE Data Export and Estimator"
            title="LSE CSV Estimator & Downloader"
            className={`w-[26px] h-[26px] rounded-full flex items-center justify-center shadow-xs transition-colors my-0.5 ${
              panelOpen && activeTab === 'export_tools'
                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                : 'bg-[var(--tv-text)] text-[var(--tv-bg-app)] hover:opacity-90'
            }`}
          >
            <Grid className="w-[14px] h-[14px]" />
          </button>

          <button
            type="button"
            onClick={onOpenUsageModal}
            aria-label="LSE API Quota and Help"
            title="LSE API Quota, Sockets & Keyboard Shortcuts"
            className="w-[28px] h-[28px] rounded-[5px] flex items-center justify-center text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors"
          >
            <HelpCircle className="w-[15px] h-[15px]" />
          </button>
        </div>
      </nav>
    </div>
  );
};
