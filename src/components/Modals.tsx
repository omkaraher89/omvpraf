import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Check,
  Eye,
  EyeOff,
  BellPlus,
  RefreshCw,
  Wifi,
  Layers,
  Trash2,
} from 'lucide-react';
import { SymbolInfo, PriceAlert, formatPrice } from '../utils/marketEngine';
import { IndicatorConfig, LseUsageData } from '../types/trading';

interface LsePairResult {
  symbol: string;
  name?: string;
  market?: string;
  currency?: string;
}

interface SymbolSearchModalProps {
  open: boolean;
  mode: 'switch' | 'compare' | 'watchlist';
  symbols: SymbolInfo[];
  activeSymbol: string;
  watchlistSymbols: string[];
  onSelectSymbol: (symbol: string) => void;
  onAddToWatchlist: (symbol: string) => void;
  onSelectLsePair: (
    market: string,
    pairSymbol: string,
    pairName: string,
    intent: 'switch' | 'compare' | 'watchlist'
  ) => Promise<void>;
  onClose: () => void;
}

const MARKET_TABS: Array<{ id: string; label: string }> = [
  { id: 'local', label: 'Watchlist & Quick' },
  { id: 'futures', label: 'Futures' },
  { id: 'us_stocks', label: 'US Stocks' },
  { id: 'us_options', label: 'US Options' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'indices', label: 'Indices' },
  { id: 'uk_stocks', label: 'UK Stocks' },
];

export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  open,
  mode,
  symbols,
  activeSymbol,
  watchlistSymbols,
  onSelectSymbol,
  onAddToWatchlist,
  onSelectLsePair,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [marketTab, setMarketTab] = useState<string>('local');
  const [remotePairs, setRemotePairs] = useState<LsePairResult[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [subscribingKey, setSubscribingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || marketTab === 'local') {
      setRemotePairs([]);
      return;
    }
    let cancelled = false;
    setLoadingRemote(true);
    const timer = setTimeout(async () => {
      try {
        if (marketTab === 'us_options') {
          const rawQ = query.trim().toUpperCase();
          // Extract underlying root if user typed e.g. "AAPL" or "AAPL 335" or OCC code
          const rootMatch = rawQ.match(/^([A-Z]{1,6})/);
          const underlying = rootMatch ? rootMatch[1] : 'AAPL';
          const chainQs = new URLSearchParams({ underlying, limit: '45' });
          const res = await fetch(`/api/lse/options/chain?${chainQs.toString()}`);
          if (res.ok) {
            const data = await res.json();
            const contracts = Array.isArray(data.contracts) ? data.contracts : [];
            const mapped: LsePairResult[] = contracts
              .map((c: any) => ({
                symbol: c.occSymbol || c.ticker,
                name: `${c.underlying} ${c.expiry} $${c.strike}${c.contract_type === 'call' ? 'C' : 'P'} · Last $${Number(c.last_price || 0).toFixed(2)}${c.iv ? ` · IV ${(c.iv * 100).toFixed(1)}%` : ''}`,
                market: 'us_options',
                currency: 'USD',
              }))
              .filter((item: LsePairResult) => {
                if (!rawQ || rawQ === underlying) return true;
                return (
                  item.symbol.toUpperCase().includes(rawQ) ||
                  (item.name || '').toUpperCase().includes(rawQ)
                );
              });
            if (!cancelled && mapped.length > 0) {
              setRemotePairs(mapped);
              return;
            }
          }
        }

        const qs = new URLSearchParams({
          market: marketTab,
          limit: '40',
        });
        if (query.trim()) qs.set('q', query.trim());
        const res = await fetch(`/api/lse/pairs?${qs.toString()}`);
        if (!res.ok) throw new Error('Failed to load LSE pairs');
        const data = await res.json();
        if (!cancelled) {
          const pairs = Array.isArray(data.pairs)
            ? data.pairs
            : Array.isArray(data.rows)
            ? data.rows
            : Array.isArray(data.symbols)
            ? data.symbols
            : [];
          setRemotePairs(pairs);
        }
      } catch {
        if (!cancelled) setRemotePairs([]);
      } finally {
        if (!cancelled) setLoadingRemote(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, marketTab, query]);

  if (!open) return null;

  const filteredLocal = symbols.filter((s) => {
    const matchesQuery =
      !query.trim() ||
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.exchange.toLowerCase().includes(query.toLowerCase());
    return matchesQuery;
  });

  const handleChooseRemote = async (
    pair: LsePairResult,
    intent: 'switch' | 'compare' | 'watchlist'
  ) => {
    const mkt = pair.market || marketTab;
    setSubscribingKey(pair.symbol);
    try {
      await onSelectLsePair(mkt, pair.symbol, pair.name || pair.symbol, intent);
      onClose();
    } finally {
      setSubscribingKey(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Symbol Search"
    >
      <div className="w-full max-w-2xl tv-glass-popover border rounded-xl overflow-hidden text-[var(--tv-text)]">
        <div className="px-4 py-3 border-b border-[var(--tv-border-glass)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--tv-text)]">
            {mode === 'watchlist'
              ? 'Add LSE Instrument to Watchlist'
              : mode === 'compare'
              ? 'Compare Overlay or Switch Instrument'
              : 'LSE Data 3.0 Symbol Search'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Symbol Search"
            className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] p-1 rounded-lg hover:bg-[var(--tv-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-4 py-2.5 border-b border-[var(--tv-border-glass)] flex items-center gap-2 tv-glass-input">
          <Search className="w-4 h-4 text-[var(--tv-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any LSE symbol (e.g. AAPL, MSFT, NASDAQ100, BTCUSDT, EUR_USD, GOLD)..."
            aria-label="Search symbols"
            autoFocus
            className="w-full bg-transparent text-xs text-[var(--tv-text)] placeholder-[var(--tv-text-muted)] focus:outline-none"
          />
        </div>

        {/* LSE Market Category Tabs */}
        <div className="px-4 py-2 border-b border-[var(--tv-border-glass)] flex items-center gap-1 overflow-x-auto">
          {MARKET_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMarketTab(tab.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition-colors border ${
                marketTab === tab.id
                  ? 'bg-[var(--tv-accent)] border-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                  : 'tv-glass-card text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--tv-border-glass)]">
          {marketTab === 'local' ? (
            filteredLocal.map((item) => {
              const inWatchlist = watchlistSymbols.includes(item.symbol);
              return (
                <div
                  key={item.symbol}
                  onClick={() => {
                    if (mode === 'watchlist') {
                      onAddToWatchlist(item.symbol);
                    } else if (mode === 'compare') {
                      onSelectLsePair(item.lseMarket, item.lseHttpSymbol, item.name, 'compare');
                    } else {
                      onSelectSymbol(item.symbol);
                    }
                    onClose();
                  }}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--tv-bg-hover)] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor: item.badgeBg,
                        color: item.badgeColor || '#ffffff',
                      }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                    >
                      {item.badgeText}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-[var(--tv-text)] flex items-center gap-2">
                        <span>{item.symbol}</span>
                        {item.symbol === activeSymbol && (
                          <span className="text-[10px] text-[var(--tv-accent)] font-normal">Active</span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--tv-text-secondary)]">{item.name}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="text-right">
                      <div className="text-xs font-mono text-[var(--tv-text)] tabular-nums">
                        {formatPrice(item.price, item.decimals)}
                      </div>
                      <div className="text-[10px] text-[var(--tv-text-muted)]">
                        {item.type} · {item.exchange}
                      </div>
                    </div>
                    {mode === 'compare' && item.symbol !== activeSymbol && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onSelectLsePair(item.lseMarket, item.lseHttpSymbol, item.name, 'compare');
                          onClose();
                        }}
                        className="px-2 py-1 rounded bg-[var(--tv-accent-soft)] text-[var(--tv-accent)] hover:bg-[var(--tv-accent)] hover:text-[var(--tv-accent-contrast)] text-[10.5px] font-medium flex items-center gap-1 transition-colors"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Overlay</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onAddToWatchlist(item.symbol);
                      }}
                      aria-label={
                        inWatchlist
                          ? `${item.symbol} in Watchlist`
                          : `Add ${item.symbol} to Watchlist`
                      }
                      className={`w-7 h-7 rounded flex items-center justify-center border transition-colors ${
                        inWatchlist
                          ? 'border-[#089981] text-[#089981]'
                          : 'border-[var(--tv-border)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] hover:border-[var(--tv-text)]'
                      }`}
                    >
                      {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })
          ) : loadingRemote ? (
            <div className="py-10 text-center text-xs text-[var(--tv-text-secondary)]">
              Querying LSE Data 3.0 catalogue ({marketTab})...
            </div>
          ) : remotePairs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--tv-text-muted)]">
              No instruments matched in {marketTab}. Try another search term.
            </div>
          ) : (
            remotePairs.map((pair) => {
              const isBusy = subscribingKey === pair.symbol;
              return (
                <div
                  key={`${marketTab}-${pair.symbol}`}
                  onClick={() => handleChooseRemote(pair, mode)}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--tv-bg-hover)] cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="text-xs font-bold text-[var(--tv-text)] flex items-center gap-2">
                      <span>{pair.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded tv-glass-card border text-[var(--tv-text-secondary)] font-normal uppercase">
                        {marketTab}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--tv-text-secondary)] truncate">
                      {pair.name || pair.symbol}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isBusy ? (
                      <span className="text-[11px] text-[var(--tv-accent)]">Loading...</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleChooseRemote(pair, 'compare');
                          }}
                          className="px-2 py-1 rounded tv-glass-card border hover:bg-[var(--tv-accent)] hover:border-[var(--tv-accent)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-accent-contrast)] text-[10.5px] transition-colors"
                        >
                          Compare
                        </button>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleChooseRemote(pair, 'watchlist');
                          }}
                          aria-label={`Add ${pair.symbol} to Watchlist`}
                          className="px-2 py-1 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[10.5px] font-medium transition-opacity"
                        >
                          + Watchlist
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface IndicatorsModalProps {
  open: boolean;
  indicators: IndicatorConfig[];
  onToggleIndicator: (id: string) => void;
  onRemoveIndicator?: (id: string) => void;
  onClose: () => void;
}

export const IndicatorsModal: React.FC<IndicatorsModalProps> = ({
  open,
  indicators,
  onToggleIndicator,
  onRemoveIndicator,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  if (!open) return null;

  const filtered = indicators.filter(
    (ind) =>
      !search.trim() ||
      ind.name.toLowerCase().includes(search.toLowerCase()) ||
      ind.shortTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Indicators, Metrics, and Strategies"
    >
      <div className="w-full max-w-lg tv-glass-popover border rounded-xl overflow-hidden text-[var(--tv-text)]">
        <div className="px-4 py-3 border-b border-[var(--tv-border-glass)] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--tv-text)]">Indicators, Metrics & Strategies</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Indicators Modal"
            className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] p-1 rounded-lg hover:bg-[var(--tv-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-[var(--tv-border-glass)] flex items-center gap-2 tv-glass-input">
          <Search className="w-4 h-4 text-[var(--tv-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search indicators (e.g. IV WALLS, VWAP, EMA, SMA, Bollinger)..."
            aria-label="Search indicators"
            className="w-full bg-transparent text-xs text-[var(--tv-text)] placeholder-[var(--tv-text-muted)] focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--tv-border-glass)]">
          {filtered.map((ind) => (
            <div
              key={ind.id}
              onClick={() => onToggleIndicator(ind.id)}
              className="px-4 py-3 flex items-center justify-between hover:bg-[var(--tv-bg-hover)] cursor-pointer transition-colors"
            >
              <div>
                <div className="text-xs font-semibold text-[var(--tv-text)]">{ind.name}</div>
                <div className="text-[11px] text-[var(--tv-text-muted)] font-mono mt-0.5 truncate max-w-sm">
                  {ind.shortTitle} {ind.paramsText}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {ind.removed ? (
                  <button
                    type="button"
                    aria-label={`Add ${ind.name} to chart`}
                    className="px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 border tv-glass-card text-[var(--tv-accent)] hover:bg-[var(--tv-accent)] hover:text-[var(--tv-accent-contrast)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`Toggle ${ind.name}`}
                      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                        ind.visible
                          ? 'bg-[var(--tv-accent)] border-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                          : 'tv-glass-card text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
                      }`}
                    >
                      {ind.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{ind.visible ? 'Visible' : 'Hidden'}</span>
                    </button>
                    {onRemoveIndicator && (
                      <button
                        type="button"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onRemoveIndicator(ind.id);
                        }}
                        aria-label={`Delete ${ind.name} from chart`}
                        title={`Delete ${ind.name} from chart`}
                        className="p-1.5 rounded border tv-glass-card text-[var(--tv-text-muted)] hover:text-[#f23645] hover:border-[#f23645]/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface CreateAlertModalProps {
  open: boolean;
  symbolInfo: SymbolInfo;
  onCreateAlert: (alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>) => void;
  onClose: () => void;
}

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  open,
  symbolInfo,
  onCreateAlert,
  onClose,
}) => {
  const [condition, setCondition] = useState<PriceAlert['condition']>('Crossing');
  const [targetPrice, setTargetPrice] = useState<string>(String(symbolInfo.price));
  const [note, setNote] = useState<string>(`${symbolInfo.symbol} 1σ IV Wall Alert`);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTargetPrice(String(symbolInfo.price));
      setNote(`${symbolInfo.symbol} Price Level Alert`);
      setError('');
    }
  }, [open, symbolInfo.symbol, symbolInfo.price]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(targetPrice);
    if (!Number.isFinite(num) || num <= 0) {
      setError('Please enter a valid positive target price.');
      return;
    }
    onCreateAlert({
      symbol: symbolInfo.symbol,
      condition,
      targetPrice: num,
      note: note.trim() || `${symbolInfo.symbol} price alert`,
      active: true,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Create Alert on ${symbolInfo.symbol}`}
    >
      <div className="w-full max-w-md tv-glass-popover border rounded-xl overflow-hidden text-[var(--tv-text)]">
        <div className="px-4 py-3 border-b border-[var(--tv-border-glass)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--tv-text)]">
            <BellPlus className="w-4 h-4 text-[var(--tv-accent)]" />
            <span>Create Alert on {symbolInfo.symbol}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Alert Modal"
            className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] p-1 rounded-lg hover:bg-[var(--tv-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          <div>
            <label className="block text-[var(--tv-text-secondary)] mb-1">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PriceAlert['condition'])}
              aria-label="Alert Condition"
              className="w-full h-9 tv-glass-input border rounded px-2.5 focus:outline-none focus:border-[var(--tv-accent)]"
            >
              <option value="Crossing" className="bg-[var(--tv-chart-bg)] text-[var(--tv-text)]">Crossing</option>
              <option value="Crossing Up" className="bg-[var(--tv-chart-bg)] text-[var(--tv-text)]">Crossing Up</option>
              <option value="Crossing Down" className="bg-[var(--tv-chart-bg)] text-[var(--tv-text)]">Crossing Down</option>
              <option value="Greater Than" className="bg-[var(--tv-chart-bg)] text-[var(--tv-text)]">Greater Than</option>
              <option value="Less Than" className="bg-[var(--tv-chart-bg)] text-[var(--tv-text)]">Less Than</option>
            </select>
          </div>

          <div>
            <label className="block text-[var(--tv-text-secondary)] mb-1">
              Price Level (Current: {formatPrice(symbolInfo.price, symbolInfo.decimals)})
            </label>
            <input
              type="number"
              step="any"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              aria-label="Alert Target Price"
              className="w-full h-9 tv-glass-input border rounded px-2.5 font-mono tabular-nums focus:outline-none focus:border-[var(--tv-accent)]"
            />
            {error && <p className="text-[#f23645] text-[11px] mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-[var(--tv-text-secondary)] mb-1">Alert Message / Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="Alert Message"
              className="w-full h-9 tv-glass-input border rounded px-2.5 focus:outline-none focus:border-[var(--tv-accent)]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] font-semibold transition-opacity"
            >
              Create Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface LseAccountUsageModalProps {
  open: boolean;
  usage: LseUsageData | null;
  loading: boolean;
  onRefreshUsage: () => void;
  onReconnectWs: () => void;
  onClose: () => void;
}

export const LseAccountUsageModal: React.FC<LseAccountUsageModalProps> = ({
  open,
  usage,
  loading,
  onRefreshUsage,
  onReconnectWs,
  onClose,
}) => {
  if (!open) return null;

  const dailyPct =
    usage?.rows?.per_day && usage.rows.per_day > 0
      ? Math.min(100, (usage.rows.used_today / usage.rows.per_day) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="LSE Data 3.0 Feed and Plan Status"
    >
      <div className="w-full max-w-lg tv-glass-popover border rounded-xl overflow-hidden text-xs text-[var(--tv-text)]">
        <div className="px-4 py-3 border-b border-[var(--tv-border-glass)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--tv-text)]">
            <Wifi className="w-4 h-4 text-[#089981]" />
            <span>LSE Data 3.0 Plan & WebSocket Feed</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close LSE Account Modal"
            className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] p-1 rounded-lg hover:bg-[var(--tv-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          {loading && !usage ? (
            <div className="py-8 text-center text-[var(--tv-text-secondary)]">Loading LSE account telemetry...</div>
          ) : usage ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded tv-glass-card border">
                  <div className="text-[10px] text-[var(--tv-text-muted)] uppercase">Plan Tier</div>
                  <div className="text-sm font-bold text-[var(--tv-text)] uppercase mt-0.5">
                    {usage.plan} · {usage.product}
                  </div>
                </div>
                <div className="p-2.5 rounded tv-glass-card border">
                  <div className="text-[10px] text-[var(--tv-text-muted)] uppercase">Rate Limit</div>
                  <div className="text-sm font-mono font-bold text-[var(--tv-text)] mt-0.5">
                    {usage.calls_per_minute}/min · {usage.connections} conn
                  </div>
                </div>
                <div className="p-2.5 rounded tv-glass-card border">
                  <div className="text-[10px] text-[var(--tv-text-muted)] uppercase">API Key</div>
                  <div className="text-[11px] font-mono text-[#089981] mt-1 truncate">
                    {usage.key}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded tv-glass-card border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tv-text-secondary)] font-medium">Daily Row Allowance ({usage.rows?.day})</span>
                  <span className="font-mono text-[var(--tv-text)] tabular-nums">
                    {usage.rows?.used_today?.toLocaleString()} / {usage.rows?.per_day?.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--tv-bg-hover)] overflow-hidden">
                  <div
                    style={{ width: `${dailyPct.toFixed(1)}%` }}
                    className={`h-full ${dailyPct > 85 ? 'bg-[#f59e0b]' : 'bg-[var(--tv-accent)]'}`}
                  />
                </div>
                <div className="flex justify-between text-[10.5px] text-[var(--tv-text-muted)]">
                  <span>Max {usage.rows?.per_export?.toLocaleString()} rows/export</span>
                  <span>
                    Resets in {Math.floor((usage.rows?.resets_in_seconds || 0) / 3600)}h{' '}
                    {Math.floor(((usage.rows?.resets_in_seconds || 0) % 3600) / 60)}m
                  </span>
                </div>
              </div>

              {usage.ws && (
                <div className="p-3 rounded tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[var(--tv-text)]">Upstream WebSocket Bridges</span>
                    <span className="font-mono text-[11px] text-[#089981]">
                      Slots: {usage.ws.subscribedCount} / {usage.ws.maxSubscriptions}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between px-2 py-1.5 rounded tv-glass-input border">
                      <span className="text-[var(--tv-text-secondary)]">data-ws</span>
                      <span
                        className={`font-mono font-semibold ${
                          usage.ws.dataWs === 'authenticated' ? 'text-[#089981]' : 'text-[#f59e0b]'
                        }`}
                      >
                        {usage.ws.dataWs}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1.5 rounded tv-glass-input border">
                      <span className="text-[var(--tv-text-secondary)]">london-ws</span>
                      <span
                        className={`font-mono font-semibold ${
                          usage.ws.londonWs === 'authenticated' ? 'text-[#089981]' : 'text-[#f59e0b]'
                        }`}
                      >
                        {usage.ws.londonWs}
                      </span>
                    </div>
                  </div>
                  {usage.ws.subscribedSymbols.length > 0 && (
                    <div className="text-[10.5px] text-[var(--tv-text-muted)] font-mono leading-relaxed">
                      Subscribed: {usage.ws.subscribedSymbols.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="text-[11px] text-[var(--tv-text-secondary)] mb-1.5">Enabled LSE Markets</div>
                <div className="flex flex-wrap gap-1">
                  {(usage.markets || []).map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded tv-glass-card border text-[var(--tv-text-secondary)] text-[10.5px] font-mono"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-[#f23645]">
              Unable to reach /api/lse/usage. Check server logs or LSE API key.
            </div>
          )}

          <div className="pt-2 border-t border-[var(--tv-border-glass)] flex items-center justify-between">
            <span className="text-[10.5px] text-[var(--tv-text-muted)]">
              Shortcuts: Alt+T Trend · Alt+H Horiz · Alt+F Fib · Alt+R Rect · Del Remove
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReconnectWs}
                className="px-3 py-1.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text)] font-medium transition-colors"
              >
                Reconnect WS
              </button>
              <button
                type="button"
                onClick={onRefreshUsage}
                className="px-3 py-1.5 rounded bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] font-semibold flex items-center gap-1 transition-opacity"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
