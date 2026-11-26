import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
  BellPlus,
  Rewind,
  Lightbulb,
  SlidersHorizontal,
  Trash2,
  Sun,
  Moon,
  Settings,
  Palette,
  Cloud,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { AppThemeConfig, ChartStyleType, LAYOUT_PRESETS, LayoutSyncConfig } from '../types/trading';
import { buildCustomTimeframe } from '../utils/marketEngine';
import { LayoutGlyph, LayoutSelectorPopover } from './LayoutSelectorPopover';

interface TopToolbarProps {
  activeSymbol: string;
  onOpenSymbolSearch: (mode: 'switch' | 'compare') => void;
  activeTimeframe: string;
  timeframes: string[];
  customTimeframes: string[];
  onSelectTimeframe: (tf: string) => void;
  onAddCustomTimeframe: (tf: string) => void;
  onRemoveCustomTimeframe: (tf: string) => void;
  chartStyle: ChartStyleType;
  onSelectChartStyle: (style: ChartStyleType) => void;
  onOpenIndicators: () => void;
  activeIndicatorsCount: number;
  onOpenAlertModal: () => void;
  replayActive: boolean;
  onToggleReplay: () => void;
  onOpenTradeTicket: () => void;
  onOpenScreener: () => void;
  onOpenUsageModal: () => void;
  onOpenSettings: () => void;
  activeLayoutId: string;
  onSelectLayout: (layoutId: string) => void;
  layoutSync: LayoutSyncConfig;
  onToggleLayoutSync: (key: keyof LayoutSyncConfig) => void;
  alertBadgeCount: number;
  chartCanvasTheme: 'light' | 'dark';
  onToggleChartCanvasTheme: () => void;
  wsConnected: boolean;
  httpLiveActive?: boolean;
  liveStreamEnabled: boolean;
  onToggleLiveStream: () => void;
  onOpenGexDashboard: () => void;
  activeTheme: AppThemeConfig;
  onOpenThemeStudio: () => void;
  /** Signed-in Freebuff account display name (null when signed out). */
  accountName?: string | null;
  onSignIn?: () => void;
  onSignOut?: () => void;
  /** Save the current workspace to the signed-in account right now (no chart reset). */
  onSyncNow?: () => void;
}

const CHART_STYLE_OPTIONS: Array<{ id: ChartStyleType; label: string }> = [
  { id: 'candles', label: 'Candles' },
  { id: 'hollow_candles', label: 'Hollow candles' },
  { id: 'bars', label: 'Bars (OHLC)' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'baseline', label: 'Baseline' },
  { id: 'heikin_ashi', label: 'Heikin Ashi' },
];

export const TopToolbar: React.FC<TopToolbarProps> = ({
  activeSymbol,
  onOpenSymbolSearch,
  activeTimeframe,
  timeframes,
  customTimeframes,
  onSelectTimeframe,
  onAddCustomTimeframe,
  onRemoveCustomTimeframe,
  chartStyle,
  onSelectChartStyle,
  onOpenIndicators,
  activeIndicatorsCount,
  onOpenAlertModal,
  replayActive,
  onToggleReplay,
  onOpenTradeTicket,
  onOpenScreener,
  onOpenUsageModal,
  onOpenSettings,
  activeLayoutId,
  onSelectLayout,
  layoutSync,
  onToggleLayoutSync,
  alertBadgeCount,
  chartCanvasTheme,
  onToggleChartCanvasTheme,
  wsConnected,
  httpLiveActive = false,
  liveStreamEnabled,
  onToggleLiveStream,
  onOpenGexDashboard,
  activeTheme,
  onOpenThemeStudio,
  accountName = null,
  onSignIn,
  onSignOut,
  onSyncNow,
}) => {
  const [tfMenuOpen, setTfMenuOpen] = useState(false);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [customVal, setCustomVal] = useState('7');
  const [customUnit, setCustomUnit] = useState<'s' | 'm' | 'h' | 'D' | 'W' | 'M'>('m');
  const [customError, setCustomError] = useState('');

  const tfMenuRef = useRef<HTMLDivElement>(null);
  const styleMenuRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tfMenuRef.current && !tfMenuRef.current.contains(e.target as Node)) {
        setTfMenuOpen(false);
      }
      if (styleMenuRef.current && !styleMenuRef.current.contains(e.target as Node)) {
        setStyleMenuOpen(false);
      }
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setLayoutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLayoutPreset =
    LAYOUT_PRESETS.find((p) => p.id === activeLayoutId) || LAYOUT_PRESETS[0];

  const handleAddCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customVal, 10);
    const built = buildCustomTimeframe(num, customUnit);
    if (!built) {
      setCustomError('Enter an interval between 1 and 1000');
      return;
    }
    setCustomError('');
    onAddCustomTimeframe(built);
    onSelectTimeframe(built);
    setTfMenuOpen(false);
  };

  return (
    <header className="h-[34px] tv-glass-bar border-b flex items-center justify-between gap-2 px-1.5 select-none shrink-0 z-40 text-[var(--tv-text)] relative">
      {/* Left & Center Controls */}
      <div className="flex items-center gap-0.5 flex-1 min-w-0">
        {/* Account & LSE Feed Diagnostics Circle */}
        <button
          type="button"
          onClick={onOpenUsageModal}
          aria-label="LSE Data Feed Status and Quota"
          title="Open LSE Data 3.0 Quota & WebSocket Diagnostics"
          className="relative flex items-center justify-center w-7 h-7 rounded-full hover:bg-[var(--tv-bg-hover)] transition-colors shrink-0 mr-0.5"
        >
          <div className="w-5 h-5 rounded-full bg-[var(--tv-bg-elevated)] border border-[var(--tv-border-glass)] flex items-center justify-center text-[10px] font-semibold text-[var(--tv-text)]">
            TV
          </div>
          {alertBadgeCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 bg-[#f23645] text-white text-[8px] font-bold leading-none px-1 py-[1px] rounded-full tabular-nums">
              {alertBadgeCount}
            </span>
          ) : (
            <span
              className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-[var(--tv-bg-app)] ${
                (wsConnected || httpLiveActive) && liveStreamEnabled ? 'bg-[#089981]' : 'bg-[#f59e0b]'
              }`}
            />
          )}
        </button>

        {/* Symbol Search Pill Button */}
        <div className="flex items-center tv-glass-card hover:bg-[var(--tv-bg-hover)] rounded-full h-[24px] px-2 gap-1.5 border transition-colors shrink-0">
          <button
            type="button"
            onClick={() => onOpenSymbolSearch('switch')}
            aria-label={`Symbol Search (${activeSymbol})`}
            className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--tv-text)] tracking-tight whitespace-nowrap cursor-pointer"
          >
            <span>{activeSymbol}</span>
            <SlidersHorizontal className="w-3 h-3 text-[var(--tv-text-muted)]" />
          </button>
        </div>

        {/* Compare / Add Symbol (+) Circle Button */}
        <button
          type="button"
          onClick={() => onOpenSymbolSearch('compare')}
          aria-label="Compare or Add Symbol"
          title="Compare Overlay or Switch LSE Instrument"
          className="flex items-center justify-center w-6 h-6 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5 rounded-full border border-current p-0.5" />
        </button>

        <div className="h-4 w-[1px] bg-[var(--tv-border-glass)] mx-0.5 shrink-0" />

        {/* Timeframes Strip (scrollable inner track, unclipped popover parent) */}
        <div className="flex items-center gap-0.5 relative min-w-0" ref={tfMenuRef}>
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar min-w-0">
            {[...timeframes, ...customTimeframes].map((tf) => {
              const isActive = activeTimeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onSelectTimeframe(tf)}
                  aria-label={`Timeframe ${tf}`}
                  className={`px-1.5 h-[24px] text-[12px] rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    isActive
                      ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] font-semibold border border-[var(--tv-border-glass)]'
                      : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] font-normal'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Custom Timeframe Dropdown Trigger */}
          <button
            type="button"
            onClick={() => setTfMenuOpen((v) => !v)}
            aria-label="Custom Timeframes Menu"
            aria-expanded={tfMenuOpen}
            title="Add or select custom timeframe"
            className={`flex items-center justify-center w-5 h-[24px] rounded transition-colors shrink-0 ${
              tfMenuOpen
                ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Custom Timeframe Popover */}
          {tfMenuOpen && (
            <div className="absolute left-0 top-[34px] w-72 tv-glass-popover border rounded-xl p-3 z-50 text-[var(--tv-text)]">
              <div className="text-[11px] font-semibold text-[var(--tv-text-muted)] uppercase tracking-wider mb-2">
                Add Custom Interval
              </div>
              <form onSubmit={handleAddCustomSubmit} className="flex items-center gap-1.5 mb-2">
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  aria-label="Custom interval value"
                  className="w-16 h-8 tv-glass-input border rounded px-2 text-xs tabular-nums focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value as 's' | 'm' | 'h' | 'D' | 'W' | 'M')}
                  aria-label="Custom interval unit"
                  className="flex-1 h-8 tv-glass-input border rounded px-2 text-xs focus:outline-none focus:border-[var(--tv-accent)]"
                >
                  <option value="s">Seconds (s)</option>
                  <option value="m">Minutes (m)</option>
                  <option value="h">Hours (h)</option>
                  <option value="D">Days (D)</option>
                  <option value="W">Weeks (W)</option>
                  <option value="M">Months (M)</option>
                </select>
                <button
                  type="submit"
                  className="h-8 px-3 bg-[#2962ff] hover:bg-[#1e53e5] text-white text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0"
                >
                  Add
                </button>
              </form>
              {customError && <p className="text-[11px] text-[#f23645] mb-2">{customError}</p>}

              <div className="border-t border-[var(--tv-border-glass)] pt-2 mt-1">
                <div className="text-[11px] text-[var(--tv-text-muted)] mb-1.5">Seconds (LSE Live + History)</div>
                <div className="grid grid-cols-4 gap-1 mb-2.5">
                  {['1s', '5s', '15s', '30s'].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => {
                        if (!timeframes.includes(tf) && !customTimeframes.includes(tf)) {
                          onAddCustomTimeframe(tf);
                        }
                        onSelectTimeframe(tf);
                        setTfMenuOpen(false);
                      }}
                      className={`py-1 rounded border text-xs tabular-nums transition-colors ${
                        activeTimeframe === tf
                          ? 'bg-[var(--tv-accent)] border-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                          : 'tv-glass-input border hover:bg-[var(--tv-bg-hover)]'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="text-[11px] text-[var(--tv-text-muted)] mb-1.5">Quick Presets & Custom Intervals</div>
                <div className="flex flex-wrap gap-1">
                  {['10s', '45s', '2m', '7m', '10m', '45m', '2h', '6h', '3D', ...customTimeframes]
                    .filter((v, idx, arr) => arr.indexOf(v) === idx)
                    .map((tf) => {
                      const isUserAdded = customTimeframes.includes(tf);
                      return (
                        <div
                          key={tf}
                          className="inline-flex items-center tv-glass-input border rounded overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (!timeframes.includes(tf) && !customTimeframes.includes(tf)) {
                                onAddCustomTimeframe(tf);
                              }
                              onSelectTimeframe(tf);
                              setTfMenuOpen(false);
                            }}
                            className={`px-2 py-1 text-xs tabular-nums transition-colors ${
                              activeTimeframe === tf
                                ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                                : 'text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
                            }`}
                          >
                            {tf}
                          </button>
                          {isUserAdded && (
                            <button
                              type="button"
                              onClick={() => onRemoveCustomTimeframe(tf)}
                              aria-label={`Remove custom timeframe ${tf}`}
                              className="px-1 py-1 text-[var(--tv-text-muted)] hover:text-[#f23645]"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[var(--tv-border-glass)] mx-0.5 shrink-0" />

        {/* Chart Style Selector */}
        <div className="flex items-center gap-0.5 relative shrink-0" ref={styleMenuRef}>
          <button
            type="button"
            onClick={() => onSelectChartStyle('candles')}
            aria-label="Candlestick Chart Style"
            title="Candles"
            className={`flex items-center justify-center w-6 h-[24px] rounded transition-colors shrink-0 ${
              chartStyle === 'candles' || chartStyle === 'hollow_candles' || chartStyle === 'heikin_ashi'
                ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <line x1="8" y1="3" x2="8" y2="7" />
              <rect x="5.5" y="7" width="5" height="10" rx="0.5" />
              <line x1="8" y1="17" x2="8" y2="21" />
              <line x1="16" y1="5" x2="16" y2="9" />
              <rect x="13.5" y="9" width="5" height="7" rx="0.5" />
              <line x1="16" y1="16" x2="16" y2="20" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => onSelectChartStyle(chartStyle === 'line' ? 'area' : 'line')}
            aria-label="Line or Area Chart Style"
            title="Line / Area"
            className={`flex items-center justify-center w-6 h-[24px] rounded transition-colors shrink-0 ${
              chartStyle === 'line' || chartStyle === 'area' || chartStyle === 'baseline'
                ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <polyline points="3 17 9 11 13 15 21 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setStyleMenuOpen((v) => !v)}
            aria-label="More Chart Styles"
            aria-expanded={styleMenuOpen}
            className="flex items-center justify-center w-4 h-[24px] rounded text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors shrink-0"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {styleMenuOpen && (
            <div className="absolute left-0 top-[28px] w-44 tv-glass-popover border rounded-xl py-1 z-50">
              {CHART_STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectChartStyle(opt.id);
                    setStyleMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    chartStyle === opt.id
                      ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                      : 'text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {chartStyle === opt.id && <span className="text-[10px]">Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[var(--tv-border-glass)] mx-0.5 shrink-0" />

        {/* Indicators Button */}
        <button
          type="button"
          onClick={onOpenIndicators}
          aria-label="Indicators, Metrics, and Strategies"
          title="Indicators, Metrics & Strategies"
          className="flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)] transition-colors whitespace-nowrap shrink-0"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[var(--tv-text-secondary)]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 4 3 5-6" />
          </svg>
          <span className="hidden lg:inline">Indicators</span>
          {activeIndicatorsCount > 0 && (
            <span className="text-[10.5px] text-[var(--tv-text-muted)] tabular-nums">({activeIndicatorsCount})</span>
          )}
          <ChevronDown className="w-3 h-3 text-[var(--tv-text-muted)]" />
        </button>

        <div className="hidden sm:block h-4 w-[1px] bg-[var(--tv-border-glass)] mx-0.5 shrink-0" />

        {/* Alert Button */}
        <button
          type="button"
          onClick={onOpenAlertModal}
          aria-label="Create Price Alert"
          title="Create Price Alert"
          className="flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)] transition-colors whitespace-nowrap shrink-0"
        >
          <BellPlus className="w-3.5 h-3.5 text-[var(--tv-text-secondary)]" />
          <span className="hidden xl:inline">Alert</span>
        </button>

        {/* Replay Button */}
        <button
          type="button"
          onClick={onToggleReplay}
          aria-label="Bar Replay Mode"
          title="Bar Replay Mode"
          className={`flex items-center gap-1 px-1.5 h-[24px] rounded text-[12px] transition-colors whitespace-nowrap shrink-0 ${
            replayActive
              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
              : 'text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
          }`}
        >
          <Rewind className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Replay</span>
        </button>

        <div className="hidden sm:block h-4 w-[1px] bg-[var(--tv-border-glass)] mx-0.5 shrink-0" />

        {/* Options GEX & Orderflow Dashboard Button */}
        <button
          type="button"
          onClick={onOpenGexDashboard}
          aria-label="Options GEX and Orderflow Dashboard"
          title="Open 0DTE, 1W (5D) & Monthly GEX Levels, Gamma Flip & Options Orderflow"
          className="flex items-center gap-1 px-2 h-[24px] rounded border border-[var(--tv-accent-border)] bg-[var(--tv-accent-soft)] hover:opacity-90 text-[11.5px] font-semibold text-[var(--tv-text)] transition-opacity whitespace-nowrap shrink-0"
        >
          <span>
            GEX<span className="hidden md:inline"> Flow</span>
          </span>
        </button>
      </div>

      {/* Right Side Controls */}
      <div className="flex items-center gap-1 shrink-0 pl-1.5 border-l border-[var(--tv-border-glass)]">
        {/* Live WebSocket Indicator Button */}
        <button
          type="button"
          onClick={onToggleLiveStream}
          aria-label={liveStreamEnabled ? 'Pause Real-Time WebSocket Stream' : 'Resume Real-Time WebSocket Stream'}
          title={
            wsConnected || httpLiveActive
              ? liveStreamEnabled
                ? wsConnected
                  ? 'LSE Real-Time WebSocket Live (Click to pause)'
                  : 'LSE Live HTTP Feed Active (Click to pause)'
                : 'LSE Live Feed Paused (Click to resume)'
              : 'Connecting to LSE live market feed...'
          }
          className="hidden 2xl:flex items-center gap-1 px-1.5 h-[22px] rounded text-[10.5px] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)] transition-colors whitespace-nowrap shrink-0"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              (wsConnected || httpLiveActive) && liveStreamEnabled ? 'bg-[#089981]' : 'bg-[#f59e0b]'
            }`}
          />
          <span>{liveStreamEnabled ? (wsConnected ? 'LSE LIVE' : httpLiveActive ? 'LSE POLL' : 'CONNECTING') : 'PAUSED'}</span>
        </button>

        {/* Multi-Chart Layout Selector */}
        <div className="relative shrink-0" ref={layoutMenuRef}>
          <button
            type="button"
            onClick={() => setLayoutMenuOpen((v) => !v)}
            aria-label="Select Layout"
            aria-expanded={layoutMenuOpen}
            title="Select Multiple Chart Layout"
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors shrink-0 ${
              layoutMenuOpen || activeLayoutId !== '1'
                ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] border border-[var(--tv-border-glass)]'
                : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <LayoutGlyph preset={currentLayoutPreset} className="w-3.5 h-3.5" />
          </button>

          <LayoutSelectorPopover
            open={layoutMenuOpen}
            activeLayoutId={activeLayoutId}
            onSelectLayout={(id) => {
              onSelectLayout(id);
              setLayoutMenuOpen(false);
            }}
            syncConfig={layoutSync}
            onToggleSync={onToggleLayoutSync}
          />
        </div>

        {/* Theme & Wallpaper Studio Button */}
        <button
          type="button"
          onClick={onOpenThemeStudio}
          aria-label="Theme and Wallpaper Studio"
          title={`Themes, Glass UI & Live Wallpaper (${activeTheme.name})`}
          className="flex items-center gap-1 px-2 h-[24px] rounded border border-[var(--tv-border-glass)] bg-[var(--tv-bg-elevated)] hover:bg-[var(--tv-bg-hover)] text-[11px] font-medium text-[var(--tv-text)] transition-colors whitespace-nowrap shrink-0"
        >
          <Palette className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
          <span className="hidden lg:inline">Themes</span>
        </button>

        {/* Chart Settings Gear Button */}
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Chart Settings"
          title="Chart Settings (Symbol, Status Line, Scales, Canvas)"
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        {/* Toggle Light vs Dark Theme */}
        <button
          type="button"
          onClick={onToggleChartCanvasTheme}
          aria-label="Toggle Chart Canvas Theme"
          title={chartCanvasTheme === 'light' ? 'Switch to Dark Glass theme' : 'Switch to Arctic Daylight theme'}
          className="flex items-center justify-center w-6 h-6 rounded text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors shrink-0"
        >
          {chartCanvasTheme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
        </button>

        {/* Fundamentals & Screener Lightbulb Icon */}
        <button
          type="button"
          onClick={onOpenScreener}
          aria-label="Symbol Fundamentals and Factors"
          title="LSE Fundamentals, History & Corporate Factors"
          className="hidden sm:flex items-center justify-center w-6 h-6 rounded text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors shrink-0"
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </button>

        {/* Trade Outlined Pill Button */}
        <button
          type="button"
          onClick={onOpenTradeTicket}
          aria-label="Open Trade Panel"
          className="px-2.5 h-[24px] rounded-full border border-[var(--tv-border-glass)] hover:bg-[var(--tv-bg-hover)] text-[11.5px] font-medium text-[var(--tv-text)] transition-colors whitespace-nowrap shrink-0"
        >
          Trade
        </button>

        {/* LSE Plan & Quota Pill Button */}
        <button
          type="button"
          onClick={onOpenUsageModal}
          aria-label="LSE Plan and API Quota"
          title="View LSE Data 3.0 Plan, Row Quota & WebSocket Status"
          className="flex items-center gap-1 px-2.5 h-[24px] rounded-full text-[11.5px] font-semibold transition-opacity hover:opacity-90 whitespace-nowrap shrink-0"
          style={{
            backgroundColor: 'var(--tv-text)',
            color: 'var(--tv-bg-app)',
          }}
        >
          <span className="text-[11px]">⚡</span>
          <span className="hidden md:inline">LSE Plan</span>
          <span className="md:hidden">Plan</span>
        </button>

        {/* Sync now button (only meaningful when signed in) */}
        {onSyncNow && (
          <button
            type="button"
            onClick={onSyncNow}
            aria-label="Sync and save workspace to account"
            title="Save drawings, colors, templates, watchlist, and settings to your account without resetting the chart"
            className="flex items-center gap-1 px-2 h-[24px] rounded-full border border-[var(--tv-accent-border)] bg-[var(--tv-accent-soft)] hover:opacity-90 text-[11.5px] font-semibold text-[var(--tv-text)] transition-opacity whitespace-nowrap shrink-0"
          >
            <Cloud className="w-3 h-3 shrink-0" />
            <span>Sync</span>
          </button>
        )}

        {/* Signed-in account / sign-in */}
        {(onSignIn || accountName) &&
          (accountName ? (
            <div className="flex items-center gap-1 px-2 h-[24px] rounded-full border border-[var(--tv-border-glass)] bg-[var(--tv-bg-elevated)] text-[11px] font-medium text-[var(--tv-text)] whitespace-nowrap shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tv-bull)] shrink-0" />
              <span className="hidden md:inline max-w-[90px] truncate">{accountName}</span>
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out of your account"
                title="Sign out"
                className="ml-0.5 text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              aria-label="Sign in"
              title="Sign in to load and save this workspace with your account"
              className="flex items-center gap-1 px-2 h-[24px] rounded-full border border-[var(--tv-border-glass)] bg-[var(--tv-bg-elevated)] hover:bg-[var(--tv-bg-hover)] text-[11px] font-medium text-[var(--tv-text)] transition-colors whitespace-nowrap shrink-0"
            >
              <Cloud className="w-3.5 h-3.5 text-[var(--tv-accent)] shrink-0" />
              <span>Sign in</span>
            </button>
          ))}

      </div>
    </header>
  );
};
