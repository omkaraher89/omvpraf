import React, { useState, useRef, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftRight,
  Bold,
  Italic,
  Settings,
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
import type { DrawingSettingsTab } from './DrawingSettingsModal';

interface DrawingPropertiesBarProps {
  drawing: ChartDrawing;
  templates?: DrawingTemplate[];
  onSaveTemplate?: (name: string, drawing: ChartDrawing) => void;
  onApplyTemplate?: (template: DrawingTemplate, drawing: ChartDrawing) => void;
  onUpdate: (updated: ChartDrawing) => void;
  onToggleAngleSnap?: (drawing: ChartDrawing, enabled: boolean) => void;
  onOpenSettings?: (tab?: DrawingSettingsTab) => void;
  onClone: (drawing: ChartDrawing) => void;
  onDelete: (id: string) => void;
  onRequestEditText: (drawing: ChartDrawing) => void;
  onReorder?: (id: string, direction: 'front' | 'back') => void;
}

const TV_COLORS = [
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
  '#8b5cf6',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#64748b',
  '#ffffff',
  '#d1d4dc',
  '#787b86',
  '#363a45',
  '#131722',
];

const ALL_FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618];

type OpenMenuType = 'templates' | 'stroke' | 'fill' | 'text' | 'width' | 'style' | 'more' | null;

const CheckerColorBar: React.FC<{ color: string; opacity?: number }> = ({
  color,
  opacity = 1,
}) => (
  <span
    className="block w-4 h-[3px] rounded-full overflow-hidden relative mt-[1px]"
    style={{
      backgroundImage:
        'linear-gradient(45deg, rgba(160,160,175,0.45) 25%, transparent 25%), linear-gradient(-45deg, rgba(160,160,175,0.45) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(160,160,175,0.45) 75%), linear-gradient(-45deg, transparent 75%, rgba(160,160,175,0.45) 75%)',
      backgroundSize: '4px 4px',
      backgroundPosition: '0 0, 0 2px, 2px -2px, -2px 0',
    }}
  >
    <span
      className="absolute inset-0"
      style={{ backgroundColor: color, opacity: Math.max(0, Math.min(1, opacity)) }}
    />
  </span>
);

export const DrawingPropertiesBar: React.FC<DrawingPropertiesBarProps> = ({
  drawing,
  templates = [],
  onSaveTemplate,
  onApplyTemplate,
  onUpdate,
  onToggleAngleSnap,
  onOpenSettings,
  onClone,
  onDelete,
  onRequestEditText,
  onReorder,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 320, y: 36 });
  const [openMenu, setOpenMenu] = useState<OpenMenuType>(null);
  const [templateName, setTemplateName] = useState('');
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  useEffect(() => {
    const clampToParent = () => {
      const el = barRef.current;
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const maxX = Math.max(8, parent.clientWidth - el.offsetWidth - 8);
      const maxY = Math.max(8, parent.clientHeight - el.offsetHeight - 8);
      setPos((prev) => {
        const nx = Math.max(8, Math.min(maxX, prev.x));
        const ny = Math.max(8, Math.min(maxY, prev.y));
        return nx === prev.x && ny === prev.y ? prev : { x: nx, y: ny };
      });
    };
    clampToParent();
    const parent = barRef.current?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(clampToParent);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [drawing.id]);

  useEffect(() => {
    if (!openMenu) return;
    const onDocDown = (ev: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(ev.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [openMenu]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const el = barRef.current;
      const parent = el?.parentElement;
      const maxX =
        parent && el ? Math.max(8, parent.clientWidth - el.offsetWidth - 8) : window.innerWidth - 360;
      const maxY =
        parent && el ? Math.max(8, parent.clientHeight - el.offsetHeight - 8) : window.innerHeight - 140;
      setPos({
        x: Math.max(8, Math.min(maxX, dragRef.current.origX + ev.clientX - dragRef.current.startX)),
        y: Math.max(8, Math.min(maxY, dragRef.current.origY + ev.clientY - dragRef.current.startY)),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const lineWidth = drawing.lineWidth ?? (drawing.tool === 'rectangle' ? 2 : 1.8);
  const lineStyle = drawing.lineStyle ?? 'solid';
  const borderOpacity = drawing.showBorder === false ? 0 : (drawing.borderOpacity ?? 1);
  const fillColor = drawing.fillColor || drawing.color;
  const fillOpacity = drawing.showFill === false ? 0 : (drawing.fillOpacity ?? 0.16);
  const textColor = drawing.textColor || drawing.color;

  const isBoxLike =
    drawing.tool === 'rectangle' ||
    drawing.tool === 'circle' ||
    drawing.tool === 'triangle' ||
    drawing.tool === 'parallel-channel' ||
    drawing.tool === 'liquidity-box' ||
    drawing.tool === 'stop-channel';

  const supportsFill =
    isBoxLike ||
    drawing.tool === 'fib-levels' ||
    drawing.tool === 'fib-extension' ||
    drawing.tool === 'pitchfork';

  const supportsText = supportsRichTextTool(drawing.tool);
  const supportsAngle = supportsAngleSnapTool(drawing.tool);
  const isLine = isLineToolId(drawing.tool);

  const supportsExtend =
    drawing.tool === 'rectangle' ||
    drawing.tool === 'trend-line' ||
    drawing.tool === 'info-line' ||
    drawing.tool === 'parallel-channel' ||
    drawing.tool === 'fib-levels' ||
    drawing.tool === 'fib-extension';

  const isFibTool = drawing.tool === 'fib-levels' || drawing.tool === 'fib-extension';
  const isPositionTool = drawing.tool === 'long-position' || drawing.tool === 'short-position';

  const activeFibRatios =
    drawing.fibRatios ??
    (drawing.tool === 'fib-extension'
      ? DEFAULT_FIB_EXTENSION_RATIOS
      : DEFAULT_FIB_RETRACEMENT_RATIOS.slice(0, 7));

  return (
    <div
      ref={barRef}
      data-drawing-ui="true"
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Selected Drawing Properties"
      className="absolute z-40 flex items-center gap-0.5 tv-glass-popover border rounded-xl px-1.5 py-1 text-[11px] text-[var(--tv-text-secondary)] select-none max-w-[calc(100%-16px)] shadow-lg"
    >
      {/* 1. Drag Grip (6 dots matching TradingView) */}
      <button
        type="button"
        onMouseDown={handleDragStart}
        aria-label="Drag Drawing Properties Bar"
        title={`Move ${getToolDisplayName(drawing.tool)} Toolbar`}
        className="w-4 h-7 flex items-center justify-center text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] cursor-grab active:cursor-grabbing shrink-0"
      >
        <svg viewBox="0 0 10 16" className="w-2.5 h-3.5" fill="currentColor">
          <circle cx="3" cy="3" r="1.15" />
          <circle cx="7" cy="3" r="1.15" />
          <circle cx="3" cy="8" r="1.15" />
          <circle cx="7" cy="8" r="1.15" />
          <circle cx="3" cy="13" r="1.15" />
          <circle cx="7" cy="13" r="1.15" />
        </svg>
      </button>

      {/* 2. Templates Icon (3 squares + plus matching TradingView) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'templates' ? null : 'templates')}
          aria-label="Drawing Templates"
          title="Templates"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            openMenu === 'templates'
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <svg
            viewBox="0 0 20 20"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="5.5" height="5.5" rx="1" />
            <rect x="11.5" y="3" width="5.5" height="5.5" rx="1" />
            <rect x="3" y="11.5" width="5.5" height="5.5" rx="1" />
            <path d="M14.25 11.5v5.5M11.5 14.25H17" strokeLinecap="round" />
          </svg>
        </button>

        {openMenu === 'templates' && (
          <div className="absolute left-0 top-8 w-56 p-2.5 tv-glass-popover border rounded-xl z-50 space-y-2 shadow-xl">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)]">
              Templates
            </div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Save template as..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onSaveTemplate) {
                    const nm = templateName.trim() || `${getToolDisplayName(drawing.tool)} Style`;
                    onSaveTemplate(nm, drawing);
                    setTemplateName('');
                  }
                }}
                className="flex-1 h-7 px-2 rounded tv-glass-input border text-[11px] focus:outline-none focus:border-[var(--tv-accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  const nm = templateName.trim() || `${getToolDisplayName(drawing.tool)} Style`;
                  onSaveTemplate?.(nm, drawing);
                  setTemplateName('');
                }}
                className="h-7 px-2 rounded bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[10.5px] font-semibold"
              >
                Save
              </button>
            </div>
            {templates.length > 0 && (
              <div className="border-t border-[var(--tv-border)] pt-1.5 space-y-0.5 max-h-36 overflow-y-auto">
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      onApplyTemplate?.(tpl, drawing);
                      setOpenMenu(null);
                    }}
                    className="w-full text-left px-2 py-1 rounded hover:bg-[var(--tv-bg-hover)] text-[11.5px] text-[var(--tv-text)] truncate"
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
                setOpenMenu(null);
              }}
              className="w-full text-left px-2 py-1 rounded hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-muted)] border-t border-[var(--tv-border)] pt-1.5"
            >
              Apply Defaults
            </button>
          </div>
        )}
      </div>

      {/* 3. Stroke / Line / Border Color & Opacity (Pencil + Bottom Color Bar) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'stroke' ? null : 'stroke')}
          aria-label={isBoxLike ? 'Border Color' : 'Line Color'}
          title={isBoxLike ? 'Border Color & Opacity' : 'Line Color & Opacity'}
          className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center transition-colors ${
            openMenu === 'stroke'
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <svg
            viewBox="0 0 20 20"
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.5 3.5a1.8 1.8 0 0 1 2.55 2.55L6.7 15.4 3.2 16.3l.9-3.5 9.4-9.3z" />
            <path d="M11.6 5.4l2.5 2.5" />
          </svg>
          <CheckerColorBar color={drawing.color} opacity={borderOpacity} />
        </button>

        {openMenu === 'stroke' && (
          <div className="absolute left-0 top-8 p-2.5 tv-glass-popover border rounded-xl w-[176px] z-50 space-y-2 shadow-xl">
            <div className="grid grid-cols-5 gap-1.5">
              {TV_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Stroke Color ${c}`}
                  onClick={() => {
                    onUpdate({ ...drawing, color: c, showBorder: true });
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-xs border ${
                    drawing.color.toLowerCase() === c.toLowerCase()
                      ? 'border-[var(--tv-accent)] scale-110'
                      : 'border-[var(--tv-border)]'
                  } transition-transform`}
                />
              ))}
            </div>
            <div className="space-y-1 pt-1.5 border-t border-[var(--tv-border)]">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-[var(--tv-text-muted)]">
                  {isBoxLike ? 'Border Opacity' : 'Line Opacity'}
                </span>
                <span className="font-mono tabular-nums">{Math.round(borderOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(borderOpacity * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  onUpdate({
                    ...drawing,
                    borderOpacity: v,
                    showBorder: v > 0,
                  });
                }}
                className="w-full accent-[var(--tv-accent)] cursor-pointer"
              />
            </div>
            {isBoxLike && (
              <label className="flex items-center justify-between cursor-pointer text-[11px] pt-1 border-t border-[var(--tv-border)]">
                <span className="text-[var(--tv-text-secondary)]">Show Border</span>
                <input
                  type="checkbox"
                  checked={drawing.showBorder !== false}
                  onChange={(e) =>
                    onUpdate({
                      ...drawing,
                      showBorder: e.target.checked,
                      borderOpacity: e.target.checked ? Math.max(0.2, drawing.borderOpacity ?? 1) : 0,
                    })
                  }
                  className="accent-[var(--tv-accent)]"
                />
              </label>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-[var(--tv-border)] text-[10.5px]">
              <span className="text-[var(--tv-text-muted)]">Custom</span>
              <input
                type="color"
                value={drawing.color.startsWith('#') ? drawing.color : '#2962ff'}
                onChange={(e) => onUpdate({ ...drawing, color: e.target.value, showBorder: true })}
                aria-label="Custom Stroke Color"
                className="w-7 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Fill / Background Color & Opacity (Paint Bucket + Bottom Checker Color Bar — for Rectangle/Shapes) */}
      {supportsFill && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'fill' ? null : 'fill')}
            aria-label="Background Color"
            title="Background Color & Opacity"
            className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center transition-colors ${
              openMenu === 'fill'
                ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
                : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 9.5L9.5 4.5 4.2 9.8a1.5 1.5 0 0 0 0 2.1l3.6 3.6a1.5 1.5 0 0 0 2.1 0l4.6-6z" />
              <path d="M9.5 4.5V2.8a1.2 1.2 0 0 1 2.4 0v4.3" />
              <path d="M16.2 12.2s1.6 1.8 1.6 2.9a1.6 1.6 0 0 1-3.2 0c0-1.1 1.6-2.9 1.6-2.9z" fill="currentColor" />
            </svg>
            <CheckerColorBar color={fillColor} opacity={fillOpacity} />
          </button>

          {openMenu === 'fill' && (
            <div className="absolute left-0 top-8 p-2.5 tv-glass-popover border rounded-xl w-[176px] z-50 space-y-2 shadow-xl">
              <div className="grid grid-cols-5 gap-1.5">
                {TV_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Background Color ${c}`}
                    onClick={() => {
                      onUpdate({
                        ...drawing,
                        fillColor: c,
                        showFill: true,
                        fillOpacity: drawing.fillOpacity === 0 ? 0.16 : drawing.fillOpacity,
                      });
                    }}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-xs border ${
                      fillColor.toLowerCase() === c.toLowerCase()
                        ? 'border-[var(--tv-accent)] scale-110'
                        : 'border-[var(--tv-border)]'
                    } transition-transform`}
                  />
                ))}
              </div>
              <div className="space-y-1 pt-1.5 border-t border-[var(--tv-border)]">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[var(--tv-text-muted)]">Fill Opacity</span>
                  <span className="font-mono tabular-nums">{Math.round(fillOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={85}
                  value={Math.round(fillOpacity * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    onUpdate({ ...drawing, fillOpacity: v, showFill: v > 0 });
                  }}
                  className="w-full accent-[var(--tv-accent)] cursor-pointer"
                />
              </div>
              <label className="flex items-center justify-between cursor-pointer text-[11px] pt-1 border-t border-[var(--tv-border)]">
                <span className="text-[var(--tv-text-secondary)]">Show Background</span>
                <input
                  type="checkbox"
                  checked={drawing.showFill !== false}
                  onChange={(e) => onUpdate({ ...drawing, showFill: e.target.checked })}
                  className="accent-[var(--tv-accent)]"
                />
              </label>
              <div className="flex items-center justify-between pt-1 border-t border-[var(--tv-border)] text-[10.5px]">
                <span className="text-[var(--tv-text-muted)]">Custom</span>
                <input
                  type="color"
                  value={fillColor.startsWith('#') ? fillColor : '#2962ff'}
                  onChange={(e) => onUpdate({ ...drawing, fillColor: e.target.value, showFill: true })}
                  aria-label="Custom Background Color"
                  className="w-7 h-5 rounded cursor-pointer bg-transparent border-0 p-0"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Text Settings Button (T + Bottom Color Bar — for Lines, Rectangles & Annotations) */}
      {supportsText && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu(openMenu === 'text' ? null : 'text')}
            aria-label="Text Settings"
            title="Text Settings (Label, Font, Color, Alignment)"
            className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center transition-colors ${
              openMenu === 'text'
                ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
                : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M4.5 5.5V4h11v1.5M10 4v12M7.5 16h5" />
            </svg>
            <CheckerColorBar color={textColor} opacity={1} />
          </button>

          {openMenu === 'text' && (
            <div className="absolute left-0 top-8 p-2.5 tv-glass-popover border rounded-xl w-64 z-50 space-y-2 shadow-xl text-[11px]">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer font-medium text-[var(--tv-text)]">
                  <input
                    type="checkbox"
                    checked={drawing.showText !== false}
                    onChange={(e) => onUpdate({ ...drawing, showText: e.target.checked })}
                    className="accent-[var(--tv-accent)]"
                  />
                  <span>Show Text</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    aria-label="Quick Text Color"
                    value={textColor.startsWith('#') ? textColor : '#ffffff'}
                    onChange={(e) => onUpdate({ ...drawing, textColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border border-[var(--tv-border)] p-0"
                  />
                  <select
                    value={drawing.fontSize ?? 12}
                    onChange={(e) => onUpdate({ ...drawing, fontSize: Number(e.target.value) })}
                    aria-label="Quick Font Size"
                    className="h-6 px-1 rounded tv-glass-input border font-mono text-[10.5px]"
                  >
                    {[10, 11, 12, 14, 16, 18, 20, 24, 28].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...drawing, textBold: !drawing.textBold })}
                    aria-label="Bold"
                    className={`w-6 h-6 rounded border flex items-center justify-center ${
                      drawing.textBold
                        ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)]'
                        : 'border-[var(--tv-border)] text-[var(--tv-text-secondary)]'
                    }`}
                  >
                    <Bold className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...drawing, textItalic: !drawing.textItalic })}
                    aria-label="Italic"
                    className={`w-6 h-6 rounded border flex items-center justify-center ${
                      drawing.textItalic
                        ? 'bg-[var(--tv-accent-soft)] border-[var(--tv-accent)] text-[var(--tv-accent)]'
                        : 'border-[var(--tv-border)] text-[var(--tv-text-secondary)]'
                    }`}
                  >
                    <Italic className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <textarea
                rows={2}
                value={drawing.text || ''}
                onChange={(e) =>
                  onUpdate({ ...drawing, text: e.target.value, showText: true })
                }
                placeholder="Type text for line / box..."
                className="w-full px-2 py-1.5 rounded tv-glass-input border text-[11px] resize-none focus:outline-none focus:border-[var(--tv-accent)]"
              />

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={drawing.textAlignV ?? (isLine ? 'top' : 'middle')}
                  onChange={(e) =>
                    onUpdate({ ...drawing, textAlignV: e.target.value as TextAlignV })
                  }
                  aria-label="Quick Vertical Align"
                  className="h-6 px-1.5 rounded tv-glass-input border text-[10.5px]"
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
                  aria-label="Quick Horizontal Align"
                  className="h-6 px-1.5 rounded tv-glass-input border text-[10.5px]"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {(isLine || drawing.tool === 'parallel-channel') && (
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="text-[var(--tv-text-muted)]">Orientation</span>
                  <div className="flex items-center gap-1">
                    {(['along', 'horizontal'] as TextOrientation[]).map((ori) => (
                      <button
                        key={ori}
                        type="button"
                        onClick={() => onUpdate({ ...drawing, textOrientation: ori })}
                        className={`px-2 py-0.5 rounded capitalize ${
                          (drawing.textOrientation ?? 'along') === ori
                            ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] font-semibold'
                            : 'tv-glass-card border text-[var(--tv-text-secondary)]'
                        }`}
                      >
                        {ori === 'along' ? 'Along line' : 'Horizontal'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-[var(--tv-border)]">
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    if (onOpenSettings) {
                      onOpenSettings('text');
                    } else {
                      onRequestEditText(drawing);
                    }
                  }}
                  className="text-[var(--tv-accent)] hover:underline font-medium"
                >
                  More Text Settings...
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu(null)}
                  className="px-2 py-0.5 rounded bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)] text-[10px] font-semibold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Line / Border Width (1px / 2px / 3px / 4px) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'width' ? null : 'width')}
          aria-label="Line Thickness"
          title="Line / Border Width"
          className={`h-7 px-1.5 rounded-lg flex items-center justify-center text-[11.5px] font-mono tabular-nums transition-colors ${
            openMenu === 'width'
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)]'
          }`}
        >
          <span>{Math.max(1, Math.round(lineWidth))}px</span>
        </button>

        {openMenu === 'width' && (
          <div className="absolute left-0 top-8 py-1 tv-glass-popover border rounded-xl w-28 z-50 shadow-xl">
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, lineWidth: w });
                  setOpenMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs hover:bg-[var(--tv-bg-hover)] ${
                  Math.round(lineWidth) === w
                    ? 'text-[var(--tv-accent)] font-semibold'
                    : 'text-[var(--tv-text-secondary)]'
                }`}
              >
                <span>{w}px</span>
                <span className="w-10 bg-current rounded-full" style={{ height: `${w}px` }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 7. Line Style (— Solid / Dashed / Dotted) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'style' ? null : 'style')}
          aria-label="Line Style"
          title="Line Style"
          className={`h-7 px-1.5 rounded-lg flex items-center justify-center text-[var(--tv-text)] transition-colors ${
            openMenu === 'style' ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]' : 'hover:bg-[var(--tv-bg-hover)]'
          }`}
        >
          <svg viewBox="0 0 24 8" className="w-5 h-2" stroke="currentColor" strokeWidth="1.8">
            <line
              x1="1"
              y1="4"
              x2="23"
              y2="4"
              strokeDasharray={
                lineStyle === 'dashed' ? '5 3' : lineStyle === 'dotted' ? '2 2' : undefined
              }
            />
          </svg>
        </button>

        {openMenu === 'style' && (
          <div className="absolute left-0 top-8 py-1 tv-glass-popover border rounded-xl w-28 z-50 shadow-xl">
            {(['solid', 'dashed', 'dotted'] as LineStyleType[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, lineStyle: st });
                  setOpenMenu(null);
                }}
                className={`w-full px-2.5 py-1.5 flex items-center justify-between text-xs capitalize hover:bg-[var(--tv-bg-hover)] ${
                  lineStyle === st
                    ? 'text-[var(--tv-accent)] font-semibold'
                    : 'text-[var(--tv-text-secondary)]'
                }`}
              >
                <span>{st}</span>
                <svg viewBox="0 0 24 6" className="w-6 h-1.5" stroke="currentColor" strokeWidth="2">
                  <line
                    x1="1"
                    y1="3"
                    x2="23"
                    y2="3"
                    strokeDasharray={st === 'dashed' ? '5 3' : st === 'dotted' ? '2 2' : undefined}
                  />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 8. 45° / 90° Angle Lock Symbol (∠) — matching Screenshots 1 & 3 */}
      {supportsAngle && (
        <button
          type="button"
          onClick={() => {
            const nextSnap = !drawing.angleSnap;
            if (onToggleAngleSnap) {
              onToggleAngleSnap(drawing, nextSnap);
            } else {
              onUpdate({ ...drawing, angleSnap: nextSnap });
            }
          }}
          aria-label={
            drawing.tool === 'rectangle' || drawing.tool === 'circle'
              ? 'Lock 1:1 Aspect Ratio (45° Diagonal)'
              : 'Lock 45° / 90° Angle Snap'
          }
          title={
            drawing.tool === 'rectangle' || drawing.tool === 'circle'
              ? 'Lock 1:1 Square / 45° Aspect'
              : 'Snap 45° / 90° Angle Increments'
          }
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            drawing.angleSnap
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <svg
            viewBox="0 0 20 20"
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 15H16.5" />
            <path d="M3.5 15L14 4.5" />
            <path d="M9.8 15a6.3 6.3 0 0 0-1.85-4.45" />
          </svg>
        </button>
      )}

      {/* 9. Delete Selected Drawing (Trash) */}
      <button
        type="button"
        onClick={() => onDelete(drawing.id)}
        aria-label="Delete Selected Drawing"
        title="Remove (Delete / Backspace)"
        className="w-7 h-7 rounded-lg hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)] hover:text-[var(--tv-bear)] flex items-center justify-center transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* 10. More & Full TradingView Settings Modal (•••) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
          aria-label="More Drawing Options and Settings"
          title="Settings & More Options"
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            openMenu === 'more'
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <circle cx="4.5" cy="10" r="1.4" />
            <circle cx="10" cy="10" r="1.4" />
            <circle cx="15.5" cy="10" r="1.4" />
          </svg>
        </button>

        {openMenu === 'more' && (
          <div className="absolute right-0 top-8 w-60 p-1.5 tv-glass-popover border rounded-xl z-50 space-y-1 text-[11.5px] text-[var(--tv-text)] shadow-xl">
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onOpenSettings?.('style');
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--tv-bg-hover)] font-medium"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                <span>Settings...</span>
              </span>
              <span className="text-[10px] text-[var(--tv-text-muted)]">Style / Coords</span>
            </button>

            {supportsText && (
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  if (onOpenSettings) {
                    onOpenSettings('text');
                  } else {
                    onRequestEditText(drawing);
                  }
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--tv-bg-hover)]"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                  <span>Text Settings...</span>
                </span>
              </button>
            )}

            {/* Quick Extend Left / Right */}
            {supportsExtend && (
              <div className="grid grid-cols-2 gap-1 px-1 py-1 border-t border-[var(--tv-border)]">
                <button
                  type="button"
                  onClick={() => onUpdate({ ...drawing, extendLeft: !drawing.extendLeft })}
                  className={`py-1 rounded text-[10.5px] font-medium ${
                    drawing.extendLeft
                      ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
                      : 'hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)]'
                  }`}
                >
                  ← Extend Left
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate({ ...drawing, extendRight: !drawing.extendRight })}
                  className={`py-1 rounded text-[10.5px] font-medium ${
                    drawing.extendRight
                      ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
                      : 'hover:bg-[var(--tv-bg-hover)] text-[var(--tv-text-secondary)]'
                  }`}
                >
                  Extend Right →
                </button>
              </div>
            )}

            {/* Quick Middle line toggle for Rectangle / Channel */}
            {(drawing.tool === 'rectangle' || drawing.tool === 'parallel-channel') && (
              <label className="flex items-center justify-between px-2.5 py-1 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer text-[11px]">
                <span>Middle Line</span>
                <input
                  type="checkbox"
                  checked={Boolean(drawing.showMidline)}
                  onChange={(e) => onUpdate({ ...drawing, showMidline: e.target.checked })}
                  className="accent-[var(--tv-accent)]"
                />
              </label>
            )}

            {isFibTool && (
              <div className="px-2 py-1 border-t border-[var(--tv-border)] space-y-1">
                <button
                  type="button"
                  onClick={() => onUpdate({ ...drawing, reverseFib: !drawing.reverseFib })}
                  className="w-full flex items-center justify-between py-1 text-[11px] hover:text-[var(--tv-accent)]"
                >
                  <span>Reverse Fib Levels</span>
                  <ArrowLeftRight className="w-3 h-3" />
                </button>
                <div className="grid grid-cols-3 gap-1">
                  {ALL_FIB_RATIOS.map((r) => {
                    const checked = activeFibRatios.includes(r);
                    return (
                      <label
                        key={r}
                        className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-[var(--tv-bg-hover)] cursor-pointer font-mono text-[10px]"
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

            {isPositionTool && (
              <div className="grid grid-cols-2 gap-1.5 px-1.5 py-1 border-t border-[var(--tv-border)]">
                <label className="space-y-0.5">
                  <span className="text-[10px] text-[var(--tv-text-muted)]">Account ($)</span>
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
                    className="w-full h-6 px-1.5 rounded tv-glass-input border text-[10.5px] font-mono tabular-nums"
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="text-[10px] text-[var(--tv-text-muted)]">Risk (%)</span>
                  <input
                    type="number"
                    min={0.1}
                    max={100}
                    step={0.25}
                    value={drawing.riskPct ?? 1}
                    onChange={(e) =>
                      onUpdate({ ...drawing, riskPct: Math.max(0.1, Number(e.target.value) || 1) })
                    }
                    className="w-full h-6 px-1.5 rounded tv-glass-input border text-[10.5px] font-mono tabular-nums"
                  />
                </label>
              </div>
            )}

            <div className="border-t border-[var(--tv-border)] pt-1 space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  onClone(drawing);
                  setOpenMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[var(--tv-bg-hover)]"
              >
                <Copy className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                <span>Clone</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, locked: !drawing.locked });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[var(--tv-bg-hover)]"
              >
                {drawing.locked ? (
                  <Unlock className="w-3.5 h-3.5 text-[var(--tv-accent)]" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                )}
                <span>{drawing.locked ? 'Unlock' : 'Lock'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdate({ ...drawing, visible: drawing.visible === false });
                  setOpenMenu(null);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1 rounded hover:bg-[var(--tv-bg-hover)]"
              >
                {drawing.visible === false ? (
                  <Eye className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-[var(--tv-text-muted)]" />
                )}
                <span>{drawing.visible === false ? 'Show' : 'Hide'}</span>
              </button>
              {onReorder && (
                <div className="grid grid-cols-2 gap-1 px-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onReorder(drawing.id, 'front');
                      setOpenMenu(null);
                    }}
                    className="flex items-center justify-center gap-1 py-1 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px]"
                  >
                    <ArrowUpToLine className="w-3 h-3" />
                    <span>Front</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onReorder(drawing.id, 'back');
                      setOpenMenu(null);
                    }}
                    className="flex items-center justify-center gap-1 py-1 rounded tv-glass-card border hover:bg-[var(--tv-bg-hover)] text-[10.5px]"
                  >
                    <ArrowDownToLine className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
