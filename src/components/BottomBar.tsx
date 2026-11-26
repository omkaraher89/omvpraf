import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Check, X } from 'lucide-react';
import { TIMEZONE_OPTIONS, resolveTimezoneIana } from '../types/trading';

interface BottomBarProps {
  activeRange: string;
  onSelectRange: (range: string) => void;
  toDate: string;
  onSelectToDate: (dateStr: string) => void;
  ethSession: 'ETH' | 'RTH';
  onToggleEthSession: () => void;
  backAdjusted: boolean;
  onToggleBackAdjusted: () => void;
  logScale: boolean;
  onToggleLogScale: () => void;
  autoScale: boolean;
  onToggleAutoScale: () => void;
  loadingCandles?: boolean;
  timezoneId: string;
  onSelectTimezone: (tzId: string) => void;
  activeSymbolMarket?: string;
}

const DATE_RANGES = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'All'];

export const BottomBar: React.FC<BottomBarProps> = ({
  activeRange,
  onSelectRange,
  toDate,
  onSelectToDate,
  ethSession,
  onToggleEthSession,
  backAdjusted,
  onToggleBackAdjusted,
  logScale,
  onToggleLogScale,
  autoScale,
  onToggleAutoScale,
  loadingCandles = false,
  timezoneId,
  onSelectTimezone,
  activeSymbolMarket,
}) => {
  const [clockStr, setClockStr] = useState('');
  const [tzMenuOpen, setTzMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(toDate || new Date().toISOString().slice(0, 10));
  const datePopoverRef = useRef<HTMLDivElement>(null);
  const tzPopoverRef = useRef<HTMLDivElement>(null);
  const activeTzItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (toDate) setDraftDate(toDate);
  }, [toDate]);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const ianaTz = resolveTimezoneIana(timezoneId, activeSymbolMarket);
      const selectedOpt =
        TIMEZONE_OPTIONS.find((t) => t.id === timezoneId) || TIMEZONE_OPTIONS[0];
      try {
        const s = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: ianaTz,
        });
        const badge =
          timezoneId === 'Exchange'
            ? `EXCH (${ianaTz === 'Europe/London' ? 'UTC+0' : ianaTz === 'UTC' ? 'UTC' : 'UTC-5'})`
            : selectedOpt.shortBadge;
        setClockStr(`${s} ${badge}`);
      } catch {
        setClockStr(`${now.toISOString().slice(11, 19)} UTC`);
      }
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [timezoneId, activeSymbolMarket]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setDateMenuOpen(false);
      }
      if (tzPopoverRef.current && !tzPopoverRef.current.contains(e.target as Node)) {
        setTzMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (tzMenuOpen && activeTzItemRef.current) {
      activeTzItemRef.current.scrollIntoView({ block: 'center' });
    }
  }, [tzMenuOpen]);

  const jumpRelativeDays = (daysAgo: number) => {
    const d = new Date(Date.now() - daysAgo * 86400 * 1000);
    const iso = d.toISOString().slice(0, 10);
    setDraftDate(iso);
    onSelectToDate(daysAgo === 0 ? '' : iso);
    setDateMenuOpen(false);
  };

  return (
    <footer className="min-h-[30px] pb-[env(safe-area-inset-bottom)] tv-glass-bar border-t flex items-center justify-between gap-2 px-2 text-[11px] text-[var(--tv-text-secondary)] select-none shrink-0 z-30">
      {/* Left Date Range Presets: 1D 5D 1M 3M 6M YTD 1Y 5Y All | Calendar */}
      <div className="flex items-center gap-0.5 relative min-w-0 overflow-x-auto no-scrollbar py-0.5" ref={datePopoverRef}>
        {DATE_RANGES.map((range) => {
          const isActive = activeRange === range;
          return (
            <button
              key={range}
              type="button"
              onClick={() => onSelectRange(range)}
              aria-label={`Range ${range}`}
              className={`px-1.5 py-0.5 rounded transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] font-semibold border border-[var(--tv-border-glass)]'
                  : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
              }`}
            >
              {range}
            </button>
          );
        })}

        <div className="h-3.5 w-[1px] bg-[var(--tv-border-glass)] mx-1" />

        <button
          type="button"
          onClick={() => setDateMenuOpen((v) => !v)}
          aria-label="Go to Date"
          title={toDate ? `Anchor date: ${toDate}` : 'Go to historical date'}
          className={`p-0.5 rounded transition-colors flex items-center gap-1 ${
            dateMenuOpen || toDate
              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
              : 'hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
          }`}
        >
          <Calendar className="w-3 h-3" />
          {toDate && <span className="text-[10px] font-mono pr-0.5">{toDate}</span>}
        </button>

        {loadingCandles && (
          <span className="ml-2 text-[10px] font-mono text-[var(--tv-accent)] animate-pulse">
            Loading LSE bars...
          </span>
        )}

        {dateMenuOpen && (
          <div className="absolute left-0 bottom-[30px] w-64 tv-glass-popover border rounded-xl p-2.5 z-50 text-[var(--tv-text)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold">Go to Date (LSE Window)</span>
              <button
                type="button"
                onClick={() => setDateMenuOpen(false)}
                className="text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draftDate) {
                  onSelectToDate(draftDate);
                  setDateMenuOpen(false);
                }
              }}
              className="flex items-center gap-1.5 mb-2"
            >
              <input
                type="date"
                value={draftDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDraftDate(e.target.value)}
                aria-label="Select end date"
                className="flex-1 h-7 tv-glass-input border rounded px-2 text-[11px] font-mono focus:outline-none focus:border-[var(--tv-accent)]"
              />
              <button
                type="submit"
                className="h-7 px-2.5 rounded bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[11px] font-semibold hover:opacity-90"
              >
                Go
              </button>
            </form>
            <div className="flex flex-wrap gap-1 pt-1.5 border-t border-[var(--tv-border-glass)]">
              <button
                type="button"
                onClick={() => jumpRelativeDays(0)}
                className="px-2 py-0.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px]"
              >
                Latest
              </button>
              <button
                type="button"
                onClick={() => jumpRelativeDays(7)}
                className="px-2 py-0.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px] text-[var(--tv-text-secondary)]"
              >
                -7D
              </button>
              <button
                type="button"
                onClick={() => jumpRelativeDays(30)}
                className="px-2 py-0.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px] text-[var(--tv-text-secondary)]"
              >
                -1M
              </button>
              <button
                type="button"
                onClick={() => jumpRelativeDays(90)}
                className="px-2 py-0.5 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px] text-[var(--tv-text-secondary)]"
              >
                -3M
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Clock & Session Controls */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
        <div className="relative" ref={tzPopoverRef}>
          <button
            type="button"
            onClick={() => setTzMenuOpen((v) => !v)}
            title="Select chart & clock timezone"
            aria-label="Select Timezone"
            aria-expanded={tzMenuOpen}
            className={`px-1.5 py-0.5 rounded transition-colors ${
              tzMenuOpen
                ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)]'
                : 'text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
            }`}
          >
            {clockStr}
          </button>

          {tzMenuOpen && (
            <div
              role="listbox"
              aria-label="Timezone Selector"
              className="absolute right-0 bottom-[30px] w-[236px] max-h-[360px] overflow-y-auto tv-glass-popover border rounded-xl py-1.5 z-50 font-sans text-[var(--tv-text)]"
            >
              {TIMEZONE_OPTIONS.map((tz) => {
                const isSelected = tz.id === timezoneId;
                return (
                  <button
                    key={tz.id}
                    ref={isSelected ? activeTzItemRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectTimezone(tz.id);
                      setTzMenuOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 flex items-center gap-2.5 text-left text-[12.5px] transition-colors ${
                      isSelected
                        ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-text)] font-medium'
                        : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
                    }`}
                  >
                    <span className="w-4 h-4 flex items-center justify-center shrink-0">
                      {isSelected && <Check className="w-3.5 h-3.5 text-[var(--tv-accent)]" />}
                    </span>
                    <span className="truncate">{tz.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleEthSession}
          aria-label="Toggle Electronic vs Regular Trading Hours"
          title="Toggle Electronic Trading Hours (ETH) vs Regular US Hours (RTH 14:30-21:00 UTC)"
          className={`px-1.5 py-0.5 rounded transition-colors ${
            ethSession === 'ETH'
              ? 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
              : 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
          }`}
        >
          {ethSession}
        </button>

        <button
          type="button"
          onClick={onToggleBackAdjusted}
          aria-label="Adjust for contract changes (B-ADJ)"
          title="Toggle LSE adjusted=1 vs unadjusted=0 bars"
          className={`px-1.5 py-0.5 rounded transition-colors ${
            backAdjusted
              ? 'bg-[var(--tv-bg-elevated)] text-[var(--tv-text)] font-semibold border border-[var(--tv-border-glass)]'
              : 'text-[var(--tv-text-muted)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          B-ADJ
        </button>

        <button
          type="button"
          onClick={onToggleLogScale}
          aria-label="Toggle Logarithmic Price Scale"
          className={`hidden sm:inline-block px-1 py-0.5 rounded text-[10.5px] transition-colors ${
            logScale
              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
              : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
          }`}
        >
          log
        </button>

        <button
          type="button"
          onClick={onToggleAutoScale}
          aria-label="Toggle Auto Price Scale"
          className={`hidden sm:inline-block px-1 py-0.5 rounded text-[10.5px] transition-colors ${
            autoScale
              ? 'text-[var(--tv-accent)] font-semibold'
              : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
          }`}
        >
          auto
        </button>
      </div>
    </footer>
  );
};
