import React, { useState, useEffect } from 'react';
import {
  X,
  Pencil,
  Check,
  ArrowUpToLine,
  ArrowDownToLine,
  Bold,
  Italic,
  LayoutGrid,
} from 'lucide-react';
import {
  ChartDrawing,
  DrawingTemplate,
  LineStyleType,
  TextAlignH,
  TextAlignV,
  TextOrientation,
} from '../types/trading';
import {
  DEFAULT_FIB_EXTENSION_RATIOS,
  DEFAULT_FIB_RETRACEMENT_RATIOS,
  getToolDisplayName,
  isLineToolId,
  supportsAngleSnapTool,
  supportsRichTextTool,
} from '../utils/drawingEngine';

export type DrawingSettingsTab = 'style' | 'text' | 'coordinates' | 'visibility';

interface DrawingSettingsModalProps {
  drawing: ChartDrawing;
  initialTab?: DrawingSettingsTab;
  tickSize?: number;
  decimals?: number;
  templates?: DrawingTemplate[];
  onSaveTemplate?: (name: string, drawing: ChartDrawing) => void;
  onApplyTemplate?: (template: DrawingTemplate, drawing: ChartDrawing) => void;
  onUpdate: (updated: ChartDrawing) => void;
  onToggleAngleSnap?: (drawing: ChartDrawing, enabled: boolean) => void;
  onReorder?: (id: string, direction: 'front' | 'back') => void;
  onClose: () => void;
}

const SWATCH_COLORS = [
  '#2962ff',
  '#089981',
  '#f23645',
  '#ff9800',
  '#9c27b0',
  '#ffeb3b',
  '#00bcd4',
  '#e91e63',
  '#4caf50',
  '#38bdf8',
  '#ffffff',
  '#d1d4dc',
  '#787b86',
  '#363a45',
  '#131722',
];

const ALL_FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618];
const TIMEFRAME_CHOICES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

function formatUnixToLocalInput(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function parseLocalInputToUnix(val: string, fallback: number): number {
  const ms = Date.parse(val);
  return Number.isFinite(ms) ? Math.round(ms / 1000) : fallback;
}

interface ColorOpacityFieldProps {
  label: string;
  checked?: boolean;
  onToggleCheck?: (next: boolean) => void;
  color: string;
  opacity?: number;
  onChangeColor: (color: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  extraRight?: React.ReactNode;
}

const ColorOpacityField: React.FC<ColorOpacityFieldProps> = ({
  label,
  checked,
  onToggleCheck,
  color,
  opacity = 1,
  onChangeColor,
  onChangeOpacity,
  extraRight,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 relative">
      <div className="flex items-center gap-2 min-w-[110px]">
        {onToggleCheck ? (
          <label className="flex items-center gap-2 cursor-pointer text-[12px] text-[var(--tv-text)]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onToggleCheck(e.target.checked)}
              className="rounded border-[var(--tv-border)] accent-[var(--tv-accent)] w-3.5 h-3.5 cursor-pointer"
            />
            <span>{label}</span>
          </label>
        ) : (
          <span className="text-[12px] text-[var(--tv-text-secondary)]">{label}</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={`${label} Color Picker`}
            className="h-7 px-2 rounded-md border border-[var(--tv-border)] tv-glass-card flex items-center gap-1.5 hover:border-[var(--tv-accent)] transition-colors"
          >
            <span
              className="w-4 h-4 rounded-xs border border-[var(--tv-border)] relative overflow-hidden"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, rgba(128,128,128,0.28) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.28) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.28) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.28) 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
              }}
            >
              <span
                className="absolute inset-0"
                style={{ backgroundColor: color, opacity }}
              />
            </span>
            {onChangeOpacity && (
              <span className="text-[10.5px] font-mono tabular-nums text-[var(--tv-text-muted)]">
                {Math.round(opacity * 100)}%
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-8 p-2.5 tv-glass-popover border rounded-xl w-48 z-50 space-y-2 shadow-xl">
              <div className="grid grid-cols-5 gap-1.5">
                {SWATCH_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      onChangeColor(c);
                      if (!onChangeOpacity) setOpen(false);
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-xs border ${
                      color.toLowerCase() === c.toLowerCase()
                        ? 'border-[var(--tv-accent)] scale-110'
                        : 'border-[var(--tv-border)]'
                    }`}
                  />
                ))}
              </div>
              {onChangeOpacity && (
                <div className="space-y-1 pt-1 border-t border-[var(--tv-border)]">
                  <div className="flex items-center justify-between text-[10.5px]">
                    <span className="text-[var(--tv-text-muted)]">Opacity</span>
                    <span className="font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(opacity * 100)}
                    onChange={(e) => onChangeOpacity(Number(e.target.value) / 100)}
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--tv-border)] text-[10.5px]">
                <span className="text-[var(--tv-text-muted)]">Custom</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#2962ff'}
                    onChange={(e) => onChangeColor(e.target.value)}
                    className="w-7 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-2 py-0.5 rounded bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[10px] font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {extraRight}
      </div>
    </div>
  );
};

export const DrawingSettingsModal: React.FC<DrawingSettingsModalProps> = ({
  drawing,
  initialTab = 'style',
  tickSize = 0.25,
  decimals = 2,
  templates = [],
  onSaveTemplate,
  onApplyTemplate,
  onUpdate,
  onToggleAngleSnap,
  onReorder,
  onClose,
}) => {
  const [snapshot, setSnapshot] = useState<ChartDrawing>(drawing);
  const [activeTab, setActiveTab] = useState<DrawingSettingsTab>(initialTab);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(drawing.title || getToolDisplayName(drawing.tool));
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState('');

  useEffect(() => {
    setSnapshot(drawing);
    setTitleDraft(drawing.title || getToolDisplayName(drawing.tool));
    setEditingTitle(false);
    // Only reset snapshot when switching to a different drawing ID
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing.id]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isRectangle = drawing.tool === 'rectangle';
  const isLine = isLineToolId(drawing.tool);
  const isBoxLike =
    isRectangle ||
    drawing.tool === 'circle' ||
    drawing.tool === 'triangle' ||
    drawing.tool === 'parallel-channel' ||
    drawing.tool === 'liquidity-box' ||
    drawing.tool === 'stop-channel';
  const isFib = drawing.tool === 'fib-levels' || drawing.tool === 'fib-extension';
  const isPosition = drawing.tool === 'long-position' || drawing.tool === 'short-position';
  const hasTextTab = supportsRichTextTool(drawing.tool);
  const canAngleSnap = supportsAngleSnapTool(drawing.tool);

  const extendMode =
    drawing.extendLeft && drawing.extendRight
      ? 'both'
      : drawing.extendLeft
      ? 'left'
      : drawing.extendRight
      ? 'right'
      : 'none';

  const setExtendMode = (mode: string) => {
    onUpdate({
      ...drawing,
      extendLeft: mode === 'left' || mode === 'both',
      extendRight: mode === 'right' || mode === 'both',
    });
  };

  const activeFibRatios =
    drawing.fibRatios ??
    (drawing.tool === 'fib-extension'
      ? DEFAULT_FIB_EXTENSION_RATIOS
      : DEFAULT_FIB_RETRACEMENT_RATIOS.slice(0, 7));

  const tabs: Array<{ id: DrawingSettingsTab; label: string }> = [
    { id: 'style', label: 'Style' },
    ...(hasTextTab ? [{ id: 'text' as const, label: 'Text' }] : []),
    { id: 'coordinates', label: 'Coordinates' },
    { id: 'visibility', label: 'Visibility' },
  ];

  return (
    <div
      data-drawing-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${getToolDisplayName(drawing.tool)} Settings`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] tv-glass-popover border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-[var(--tv-text)]"
      >
        {/* Modal Header matching TradingView Screenshot 4 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--tv-border)]">
          <div className="flex items-center gap-2 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onUpdate({ ...drawing, title: titleDraft.trim() || undefined });
                      setEditingTitle(false);
                    } else if (e.key === 'Escape') {
                      setEditingTitle(false);
                    }
                  }}
                  className="h-7 px-2 rounded tv-glass-input border text-[14px] font-semibold w-48 focus:outline-none focus:border-[var(--tv-accent)]"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdate({ ...drawing, title: titleDraft.trim() || undefined });
                    setEditingTitle(false);
                  }}
                  className="p-1 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-accent)]"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-[16px] font-semibold truncate">
                  {drawing.title || getToolDisplayName(drawing.tool)}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setTitleDraft(drawing.title || getToolDisplayName(drawing.tool));
                    setEditingTitle(true);
                  }}
                  aria-label="Rename Drawing"
                  className="p-1 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1.5 rounded-lg hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs: Style | Text | Coordinates | Visibility */}
        <div className="flex items-center gap-5 px-4 border-b border-[var(--tv-border)] text-[12.5px]">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 font-medium border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[var(--tv-text)] text-[var(--tv-text)] font-semibold'
                    : 'border-transparent text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto space-y-2.5 text-[12px] flex-1">
          {activeTab === 'style' && (
            <div className="space-y-2">
              {/* Extend Dropdown for Rectangle / Trend Lines / Channels / Fibs */}
              {(isRectangle ||
                drawing.tool === 'trend-line' ||
                drawing.tool === 'info-line' ||
                drawing.tool === 'parallel-channel' ||
                isFib) && (
                <div className="flex items-center justify-between gap-3 py-1">
                  <span className="text-[var(--tv-text-secondary)]">Extend</span>
                  <select
                    value={extendMode}
                    onChange={(e) => setExtendMode(e.target.value)}
                    aria-label="Extend Mode"
                    className="h-8 px-2.5 rounded-md border border-[var(--tv-border)] tv-glass-input text-[12px] min-w-[160px] focus:outline-none focus:border-[var(--tv-accent)]"
                  >
                    <option value="none">None</option>
                    <option value="left">Extend left</option>
                    <option value="right">Extend right</option>
                    <option value="both">Extend both</option>
                  </select>
                </div>
              )}

              {/* Border / Line Color + Opacity + Thickness + Dash */}
              <ColorOpacityField
                label={isBoxLike ? 'Border' : 'Line'}
                checked={isBoxLike ? drawing.showBorder !== false : undefined}
                onToggleCheck={
                  isBoxLike ? (next) => onUpdate({ ...drawing, showBorder: next }) : undefined
                }
                color={drawing.color}
                opacity={drawing.borderOpacity ?? 1}
                onChangeColor={(c) => onUpdate({ ...drawing, color: c })}
                onChangeOpacity={(op) => onUpdate({ ...drawing, borderOpacity: op })}
                extraRight={
                  <div className="flex items-center gap-1">
                    <select
                      value={Math.round(drawing.lineWidth ?? 1.8)}
                      onChange={(e) => onUpdate({ ...drawing, lineWidth: Number(e.target.value) })}
                      aria-label="Stroke Width"
                      className="h-7 px-1.5 rounded-md border border-[var(--tv-border)] tv-glass-input text-[11px] font-mono"
                    >
                      {[1, 2, 3, 4].map((w) => (
                        <option key={w} value={w}>
                          {w}px
                        </option>
                      ))}
                    </select>
                    <select
                      value={drawing.lineStyle ?? 'solid'}
                      onChange={(e) =>
                        onUpdate({ ...drawing, lineStyle: e.target.value as LineStyleType })
                      }
                      aria-label="Stroke Style"
                      className="h-7 px-1.5 rounded-md border border-[var(--tv-border)] tv-glass-input text-[11px] capitalize"
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                }
              />

              {/* Rectangle & Parallel Channel Middle Line */}
              {(isRectangle || drawing.tool === 'parallel-channel') && (
                <ColorOpacityField
                  label="Middle line"
                  checked={Boolean(drawing.showMidline)}
                  onToggleCheck={(next) => onUpdate({ ...drawing, showMidline: next })}
                  color={drawing.midlineColor || drawing.color}
                  opacity={drawing.midlineOpacity ?? 0.75}
                  onChangeColor={(c) => onUpdate({ ...drawing, midlineColor: c })}
                  onChangeOpacity={(op) => onUpdate({ ...drawing, midlineOpacity: op })}
                  extraRight={
                    <div className="flex items-center gap-1">
                      <select
                        value={Math.round(drawing.midlineWidth ?? 1)}
                        onChange={(e) =>
                          onUpdate({ ...drawing, midlineWidth: Number(e.target.value) })
                        }
                        aria-label="Middle Line Width"
                        className="h-7 px-1.5 rounded-md border border-[var(--tv-border)] tv-glass-input text-[11px] font-mono"
                      >
                        {[1, 2, 3].map((w) => (
                          <option key={w} value={w}>
                            {w}px
                          </option>
                        ))}
                      </select>
                      <select
                        value={drawing.midlineStyle ?? (isRectangle ? 'dotted' : 'dashed')}
                        onChange={(e) =>
                          onUpdate({ ...drawing, midlineStyle: e.target.value as LineStyleType })
                        }
                        aria-label="Middle Line Style"
                        className="h-7 px-1.5 rounded-md border border-[var(--tv-border)] tv-glass-input text-[11px] capitalize"
                      >
                        <option value="dotted">Dotted</option>
                        <option value="dashed">Dashed</option>
                        <option value="solid">Solid</option>
                      </select>
                    </div>
                  }
                />
              )}

              {/* Background / Fill for Rectangle & Shapes */}
              {(isBoxLike || isFib) && (
                <ColorOpacityField
                  label="Background"
                  checked={drawing.showFill !== false}
                  onToggleCheck={(next) => onUpdate({ ...drawing, showFill: next })}
                  color={drawing.fillColor || drawing.color}
                  opacity={drawing.fillOpacity ?? 0.16}
                  onChangeColor={(c) => onUpdate({ ...drawing, fillColor: c })}
                  onChangeOpacity={(op) => onUpdate({ ...drawing, fillOpacity: op })}
                />
              )}

              {/* Left / Right End Arrowheads for Trend Lines */}
              {(drawing.tool === 'trend-line' ||
                drawing.tool === 'ray' ||
                drawing.tool === 'extended-line' ||
                drawing.tool === 'info-line') && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg tv-glass-card border">
                    <span className="text-[11px] text-[var(--tv-text-secondary)]">Left end</span>
                    <select
                      value={drawing.leftEnd ?? 'normal'}
                      onChange={(e) =>
                        onUpdate({ ...drawing, leftEnd: e.target.value as 'normal' | 'arrow' })
                      }
                      className="bg-transparent text-[11px] font-medium focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="arrow">Arrow</option>
                    </select>
                  </label>
                  <label className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg tv-glass-card border">
                    <span className="text-[11px] text-[var(--tv-text-secondary)]">Right end</span>
                    <select
                      value={drawing.rightEnd ?? 'normal'}
                      onChange={(e) =>
                        onUpdate({ ...drawing, rightEnd: e.target.value as 'normal' | 'arrow' })
                      }
                      className="bg-transparent text-[11px] font-medium focus:outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="arrow">Arrow</option>
                    </select>
                  </label>
                </div>
              )}

              {/* 45° / 90° Angle Lock (∠) Setting */}
              {canAngleSnap && (
                <label className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg tv-glass-card border cursor-pointer">
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 18 18" className="w-4 h-4 text-[var(--tv-accent)]" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M3 14h12M3 14L12.5 4.5" strokeLinecap="round" />
                      <path d="M8.5 14a5.5 5.5 0 0 0-1.6-3.9" />
                    </svg>
                    <span>
                      {isRectangle
                        ? 'Lock 1:1 Square / 45° Aspect'
                        : 'Snap 45° / 90° Angle Increment'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(drawing.angleSnap)}
                    onChange={(e) => {
                      if (onToggleAngleSnap) {
                        onToggleAngleSnap(drawing, e.target.checked);
                      } else {
                        onUpdate({ ...drawing, angleSnap: e.target.checked });
                      }
                    }}
                    className="rounded accent-[var(--tv-accent)] w-3.5 h-3.5"
                  />
                </label>
              )}

              {/* TradingView Line Stats Checkboxes */}
              {isLine && drawing.tool !== 'horizontal-line' && drawing.tool !== 'vertical-line' && drawing.tool !== 'cross-line' && (
                <div className="pt-2 border-t border-[var(--tv-border)] space-y-1.5">
                  <div className="text-[11px] font-semibold text-[var(--tv-text-muted)] uppercase tracking-wider">
                    Stats &amp; Markers
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11.5px]">
                    {(
                      [
                        { key: 'showMiddlePoint', label: 'Middle point' },
                        { key: 'showPriceRange', label: 'Price range' },
                        { key: 'showPercentChange', label: 'Percent change' },
                        { key: 'showBarsRange', label: 'Bars & date range' },
                        { key: 'showAngle', label: 'Angle (°)' },
                        { key: 'alwaysShowStats', label: 'Always show stats' },
                      ] as const
                    ).map((item) => (
                      <label
                        key={item.key}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(drawing[item.key])}
                          onChange={(e) =>
                            onUpdate({ ...drawing, [item.key]: e.target.checked })
                          }
                          className="rounded accent-[var(--tv-accent)]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Fibonacci Ratios */}
              {isFib && (
                <div className="pt-2 border-t border-[var(--tv-border)] space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>Reverse Levels</span>
                    <input
                      type="checkbox"
                      checked={Boolean(drawing.reverseFib)}
                      onChange={(e) => onUpdate({ ...drawing, reverseFib: e.target.checked })}
                      className="rounded accent-[var(--tv-accent)]"
                    />
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {ALL_FIB_RATIOS.map((r) => {
                      const checked = activeFibRatios.includes(r);
                      return (
                        <label
                          key={r}
                          className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer font-mono text-[10.5px]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? activeFibRatios.filter((v) => v !== r)
                                : [...activeFibRatios, r].sort((a, b) => a - b);
                              onUpdate({ ...drawing, fibRatios: next });
                            }}
                            className="accent-[var(--tv-accent)]"
                          />
                          <span>{r}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Long / Short Position Risk Sizing */}
              {isPosition && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--tv-border)]">
                  <label className="space-y-1">
                    <span className="text-[11px] text-[var(--tv-text-muted)]">Account Size ($)</span>
                    <input
                      type="number"
                      min={100}
                      step={1000}
                      value={drawing.accountSize ?? 100000}
                      onChange={(e) =>
                        onUpdate({
                          ...drawing,
                          accountSize: Math.max(100, Number(e.target.value) || 100000),
                        })
                      }
                      className="w-full h-8 px-2 rounded tv-glass-input border font-mono tabular-nums"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] text-[var(--tv-text-muted)]">Risk (%)</span>
                    <input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.25}
                      value={drawing.riskPct ?? 1}
                      onChange={(e) =>
                        onUpdate({
                          ...drawing,
                          riskPct: Math.max(0.1, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full h-8 px-2 rounded tv-glass-input border font-mono tabular-nums"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {activeTab === 'text' && hasTextTab && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={drawing.showText !== false}
                    onChange={(e) => onUpdate({ ...drawing, showText: e.target.checked })}
                    className="rounded accent-[var(--tv-accent)] w-3.5 h-3.5"
                  />
                  <span>Show Text</span>
                </label>

                {/* Font Styling: Color, Font Size, Bold, Italic */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Text Color"
                    value={(drawing.textColor || drawing.color || '#ffffff').startsWith('#')
                      ? drawing.textColor || drawing.color
                      : '#ffffff'}
                    onChange={(e) => onUpdate({ ...drawing, textColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border border-[var(--tv-border)] p-0.5"
                  />
                  <select
                    value={drawing.fontSize ?? 12}
                    onChange={(e) => onUpdate({ ...drawing, fontSize: Number(e.target.value) })}
                    aria-label="Text Font Size"
                    className="h-7 px-1.5 rounded tv-glass-input border font-mono text-[11px]"
                  >
                    {[10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...drawing, textBold: !drawing.textBold })}
                    aria-label="Bold Text"
                    className={`w-7 h-7 rounded border flex items-center justify-center ${
                      drawing.textBold
                        ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)]'
                        : 'border-[var(--tv-border)] text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                    }`}
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...drawing, textItalic: !drawing.textItalic })}
                    aria-label="Italic Text"
                    className={`w-7 h-7 rounded border flex items-center justify-center ${
                      drawing.textItalic
                        ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)]'
                        : 'border-[var(--tv-border)] text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)]'
                    }`}
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <textarea
                rows={4}
                value={drawing.text || ''}
                onChange={(e) =>
                  onUpdate({
                    ...drawing,
                    text: e.target.value,
                    showText: true,
                  })
                }
                placeholder="Add text inside rectangle or along line..."
                aria-label="Drawing Text Content"
                className="w-full px-3 py-2 rounded-lg tv-glass-input border text-[12px] resize-y focus:outline-none focus:border-[var(--tv-accent)]"
              />

              {/* Text Alignment (Vertical & Horizontal) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--tv-text-secondary)]">Text alignment</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={drawing.textAlignV ?? (isLine ? 'top' : 'middle')}
                      onChange={(e) =>
                        onUpdate({ ...drawing, textAlignV: e.target.value as TextAlignV })
                      }
                      aria-label="Vertical Text Alignment"
                      className="h-7 px-2 rounded tv-glass-input border text-[11px]"
                    >
                      <option value="top">Top</option>
                      <option value="middle">Middle</option>
                      <option value="bottom">Bottom</option>
                    </select>
                    <select
                      value={drawing.textAlignH ?? 'center'}
                      onChange={(e) =>
                        onUpdate({ ...drawing, textAlignH: e.target.value as TextAlignH })
                      }
                      aria-label="Horizontal Text Alignment"
                      className="h-7 px-2 rounded tv-glass-input border text-[11px]"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>

                {(isLine || drawing.tool === 'parallel-channel') && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[var(--tv-text-secondary)]">Text orientation</span>
                    <div className="flex items-center gap-1 p-0.5 rounded-lg tv-glass-card border">
                      {(
                        [
                          { id: 'along', label: 'Along line' },
                          { id: 'horizontal', label: 'Horizontal' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdate({ ...drawing, textOrientation: opt.id as TextOrientation })
                          }
                          className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                            (drawing.textOrientation ?? 'along') === opt.id
                              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                              : 'text-[var(--tv-text-secondary)] hover:text-[var(--tv-text)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {isBoxLike && (
                  <label className="flex items-center justify-between cursor-pointer py-1">
                    <span className="text-[var(--tv-text-secondary)]">Text wrap</span>
                    <input
                      type="checkbox"
                      checked={Boolean(drawing.textWrap)}
                      onChange={(e) => onUpdate({ ...drawing, textWrap: e.target.checked })}
                      className="rounded accent-[var(--tv-accent)]"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {activeTab === 'coordinates' && (
            <div className="space-y-3">
              {drawing.points.slice(0, 4).map((pt, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[64px_1fr_1.2fr] items-center gap-2 py-1 border-b border-[var(--tv-border)] last:border-b-0"
                >
                  <span className="font-medium text-[var(--tv-text-secondary)]">
                    #{idx + 1} (P{idx + 1})
                  </span>
                  <input
                    type="number"
                    step={tickSize || 0.01}
                    value={Number(pt.p.toFixed(decimals))}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isFinite(val)) return;
                      const nextPts = drawing.points.map((p, i) =>
                        i === idx ? { ...p, p: val } : p
                      );
                      onUpdate({
                        ...drawing,
                        points: nextPts,
                        p1: nextPts[0]?.p ?? drawing.p1,
                        p2: nextPts[1]?.p ?? drawing.p2,
                      });
                    }}
                    aria-label={`Point ${idx + 1} Price`}
                    className="h-8 px-2 rounded-md tv-glass-input border font-mono tabular-nums text-[11.5px]"
                  />
                  <input
                    type="datetime-local"
                    value={formatUnixToLocalInput(pt.t)}
                    onChange={(e) => {
                      const nextT = parseLocalInputToUnix(e.target.value, pt.t);
                      const nextPts = drawing.points.map((p, i) =>
                        i === idx ? { ...p, t: nextT } : p
                      );
                      onUpdate({
                        ...drawing,
                        points: nextPts,
                        t1: nextPts[0]?.t ?? drawing.t1,
                        t2: nextPts[1]?.t ?? drawing.t2,
                      });
                    }}
                    aria-label={`Point ${idx + 1} Date Time`}
                    className="h-8 px-2 rounded-md tv-glass-input border font-mono tabular-nums text-[11px]"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'visibility' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>Visible on chart</span>
                <input
                  type="checkbox"
                  checked={drawing.visible !== false}
                  onChange={(e) => onUpdate({ ...drawing, visible: e.target.checked })}
                  className="rounded accent-[var(--tv-accent)] w-3.5 h-3.5"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>Lock position &amp; editing</span>
                <input
                  type="checkbox"
                  checked={Boolean(drawing.locked)}
                  onChange={(e) => onUpdate({ ...drawing, locked: e.target.checked })}
                  className="rounded accent-[var(--tv-accent)] w-3.5 h-3.5"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer py-1">
                <span>Show axis price / coordinates</span>
                <input
                  type="checkbox"
                  checked={drawing.showLabels !== false}
                  onChange={(e) => onUpdate({ ...drawing, showLabels: e.target.checked })}
                  className="rounded accent-[var(--tv-accent)] w-3.5 h-3.5"
                />
              </label>

              <div className="pt-2 border-t border-[var(--tv-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Show on Timeframes</span>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...drawing, visibleTimeframes: undefined })}
                    className={`text-[11px] px-2 py-0.5 rounded ${
                      !drawing.visibleTimeframes || drawing.visibleTimeframes.length === 0
                        ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)] font-semibold'
                        : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                    }`}
                  >
                    All Timeframes
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {TIMEFRAME_CHOICES.map((tf) => {
                    const list = drawing.visibleTimeframes;
                    const active = !list || list.length === 0 || list.includes(tf);
                    return (
                      <button
                        key={tf}
                        type="button"
                        onClick={() => {
                          const current = list && list.length > 0 ? list : [...TIMEFRAME_CHOICES];
                          const next = current.includes(tf)
                            ? current.filter((x) => x !== tf)
                            : [...current, tf];
                          onUpdate({
                            ...drawing,
                            visibleTimeframes:
                              next.length === 0 || next.length === TIMEFRAME_CHOICES.length
                                ? undefined
                                : next,
                          });
                        }}
                        className={`py-1 rounded border text-[11px] font-mono ${
                          active
                            ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)] font-semibold'
                            : 'border-[var(--tv-border)] text-[var(--tv-text-muted)]'
                        }`}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>
              </div>

              {onReorder && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--tv-border)]">
                  <button
                    type="button"
                    onClick={() => onReorder(drawing.id, 'front')}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[11.5px]"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5" />
                    <span>Bring to Front</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onReorder(drawing.id, 'back')}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[11.5px]"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span>Send to Back</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer matching TradingView Dialog: Templates | Cancel | Ok */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--tv-border)] relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setTemplateMenuOpen((v) => !v)}
              className="h-8 px-2.5 rounded-lg border border-[var(--tv-border)] tv-glass-card hover:bg-[var(--tv-bg-hover)] flex items-center gap-1.5 text-[11.5px]"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
              <span>Template</span>
            </button>

            {templateMenuOpen && (
              <div className="absolute left-0 bottom-9 w-56 p-2 tv-glass-popover border rounded-xl z-50 space-y-1.5 text-[11.5px]">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Template name..."
                    value={templateNameDraft}
                    onChange={(e) => setTemplateNameDraft(e.target.value)}
                    className="flex-1 h-7 px-2 rounded tv-glass-input border text-[11px] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nm = templateNameDraft.trim() || `${getToolDisplayName(drawing.tool)} Style`;
                      onSaveTemplate?.(nm, drawing);
                      setTemplateNameDraft('');
                      setTemplateMenuOpen(false);
                    }}
                    className="h-7 px-2 rounded bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[10.5px] font-semibold"
                  >
                    Save
                  </button>
                </div>

                {templates.length > 0 && (
                  <div className="border-t border-[var(--tv-border)] pt-1 space-y-0.5 max-h-36 overflow-y-auto">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          onApplyTemplate?.(tpl, drawing);
                          setTemplateMenuOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 rounded hover:bg-[var(--tv-bg-hover)] truncate"
                      >
                        {tpl.name}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onUpdate({
                      ...drawing,
                      extendLeft: false,
                      extendRight: false,
                      showBorder: true,
                      borderOpacity: 1,
                      showFill: true,
                      fillOpacity: 0.16,
                      showMidline: drawing.tool === 'parallel-channel' || drawing.tool === 'rectangle',
                      midlineStyle: drawing.tool === 'rectangle' ? 'dotted' : 'dashed',
                      angleSnap: false,
                      leftEnd: 'normal',
                      rightEnd: 'normal',
                    });
                    setTemplateMenuOpen(false);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] border-t border-[var(--tv-border)] pt-1.5"
                >
                  Apply Defaults
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onUpdate(snapshot);
                onClose();
              }}
              className="h-8 px-3.5 rounded-lg border border-[var(--tv-border)] tv-glass-card hover:bg-[var(--tv-bg-hover)] text-[12px] font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-lg bg-[var(--tv-accent)] hover:opacity-90 text-[var(--tv-accent-contrast)] text-[12px] font-semibold"
            >
              Ok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
