import React, { useState, useRef } from 'react';
import { DrawingToolId } from '../types/trading';
import { getToolDisplayName } from '../utils/drawingEngine';

interface FloatingFavoritesToolbarProps {
  activeTool: DrawingToolId;
  favoriteToolIds: DrawingToolId[];
  onSelectTool: (tool: DrawingToolId) => void;
  onQuickPlaceTool: (tool: DrawingToolId) => void;
  visible: boolean;
}

export function renderDrawingToolIcon(toolId: DrawingToolId): React.ReactNode {
  switch (toolId) {
    case 'cursor':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="3" x2="12" y2="9" />
          <line x1="12" y1="15" x2="12" y2="21" />
          <line x1="3" y1="12" x2="9" y2="12" />
          <line x1="15" y1="12" x2="21" y2="12" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    case 'trend-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="18.5" r="2" />
          <line x1="7" y1="17" x2="17" y2="7" />
          <circle cx="18.5" cy="5.5" r="2" />
        </svg>
      );
    case 'ray':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="18.5" r="2" />
          <line x1="7" y1="17" x2="20" y2="4" />
          <circle cx="13" cy="11" r="1.8" />
        </svg>
      );
    case 'info-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="18" r="1.8" />
          <line x1="6.4" y1="16.6" x2="17.6" y2="5.4" />
          <circle cx="19" cy="4" r="1.8" />
          <rect x="11" y="12.5" width="9" height="6" rx="1" />
          <line x1="13" y1="15.5" x2="18" y2="15.5" />
        </svg>
      );
    case 'extended-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="21" x2="21" y2="3" />
          <circle cx="8.5" cy="15.5" r="1.8" fill="var(--tv-bg-app)" />
          <circle cx="15.5" cy="8.5" r="1.8" fill="var(--tv-bg-app)" />
        </svg>
      );
    case 'horizontal-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="12" x2="10" y2="12" />
          <circle cx="12" cy="12" r="2" />
          <line x1="14" y1="12" x2="21" y2="12" />
        </svg>
      );
    case 'horizontal-ray':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="12" r="2" />
          <line x1="7.5" y1="12" x2="20.5" y2="12" />
        </svg>
      );
    case 'vertical-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="12" y1="3.5" x2="12" y2="10" />
          <circle cx="12" cy="12" r="2" />
          <line x1="12" y1="14" x2="12" y2="20.5" />
        </svg>
      );
    case 'cross-line':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="12" x2="10" y2="12" />
          <line x1="14" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="10" />
          <line x1="12" y1="14" x2="12" y2="21" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'parallel-channel':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="4" y1="14" x2="18" y2="5" />
          <line x1="6" y1="19" x2="20" y2="10" />
          <line x1="5" y1="16.5" x2="19" y2="7.5" strokeDasharray="2 2" />
          <circle cx="4.5" cy="13.7" r="1.5" />
          <circle cx="18" cy="5" r="1.5" />
        </svg>
      );
    case 'fib-levels':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="3" y1="5" x2="21" y2="5" />
          <line x1="3" y1="9.5" x2="17" y2="9.5" />
          <circle cx="19" cy="9.5" r="2" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'fib-extension':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="4,19 9,8 14,13" strokeDasharray="2 1.5" />
          <circle cx="4" cy="19" r="1.5" />
          <circle cx="9" cy="8" r="1.5" />
          <circle cx="14" cy="13" r="1.5" />
          <line x1="12" y1="5" x2="21" y2="5" />
          <line x1="14" y1="9" x2="21" y2="9" />
          <line x1="14" y1="13" x2="21" y2="13" />
        </svg>
      );
    case 'pitchfork':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="4.5" cy="18.5" r="1.7" />
          <line x1="5.8" y1="17.2" x2="20" y2="5" />
          <circle cx="9.5" cy="8.5" r="1.5" />
          <line x1="10.7" y1="7.4" x2="17.5" y2="2" />
          <circle cx="14.5" cy="15.5" r="1.5" />
          <line x1="15.7" y1="14.4" x2="22" y2="9" />
          <line x1="9.5" y1="8.5" x2="14.5" y2="15.5" strokeDasharray="1.5 1.5" />
        </svg>
      );
    case 'liquidity-box':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="6" r="2" />
          <line x1="7" y1="6" x2="21" y2="6" />
          <text
            x="12"
            y="14"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="8.5"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            L
          </text>
          <line x1="7" y1="15.5" x2="21" y2="15.5" />
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'stop-channel':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5" cy="6" r="2" />
          <line x1="7" y1="6" x2="21" y2="6" />
          <line x1="5" y1="10" x2="21" y2="10" />
          <text
            x="13"
            y="16"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="8"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            S
          </text>
          <circle cx="5" cy="18.5" r="2" />
          <line x1="7" y1="18.5" x2="21" y2="18.5" />
        </svg>
      );
    case 'text-note':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 7V5h14v2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
          <line x1="9" y1="19" x2="15" y2="19" strokeLinecap="round" />
        </svg>
      );
    case 'callout':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 5h13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15H11l-5 4v-4H6a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 6 5z" />
          <line x1="8.5" y1="9.5" x2="16.5" y2="9.5" />
          <line x1="8.5" y1="12" x2="14" y2="12" />
        </svg>
      );
    case 'price-label':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="4,12 9,7 20,7 20,17 9,17" />
          <circle cx="8" cy="12" r="1.2" fill="currentColor" />
          <line x1="11.5" y1="12" x2="17" y2="12" />
        </svg>
      );
    case 'rectangle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="7" y1="5" x2="17" y2="5" />
          <line x1="7" y1="19" x2="17" y2="19" />
          <line x1="5" y1="7" x2="5" y2="17" />
          <line x1="19" y1="7" x2="19" y2="17" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    case 'circle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <ellipse cx="12" cy="12" rx="8" ry="6" />
          <circle cx="12" cy="6" r="1.5" />
          <circle cx="20" cy="12" r="1.5" />
        </svg>
      );
    case 'triangle':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="12,5 20,19 4,19" />
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="20" cy="19" r="1.5" />
          <circle cx="4" cy="19" r="1.5" />
        </svg>
      );
    case 'volume-profile':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="6" y1="4" x2="6" y2="16.5" />
          <circle cx="6" cy="18.5" r="2" />
          <rect x="6" y="6" width="5" height="2.8" />
          <rect x="6" y="8.8" width="8" height="2.8" />
          <rect x="6" y="11.6" width="3.5" height="2.8" />
          <circle cx="19" cy="5.5" r="2" />
          <line x1="19" y1="7.5" x2="19" y2="20" />
        </svg>
      );
    case 'candle-pattern':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="8" y1="4" x2="8" y2="7" />
          <rect x="6" y="7" width="4" height="9" />
          <line x1="8" y1="16" x2="8" y2="20" />
          <line x1="15" y1="3.5" x2="15" y2="6.5" />
          <rect x="13" y="6.5" width="4" height="8.5" />
          <line x1="15" y1="15" x2="15" y2="19.5" />
          <circle cx="4" cy="15.5" r="1.7" />
          <path d="M5.5 14.5 L11 12.5 L20 8" />
        </svg>
      );
    case 'wave-path':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 16.5 L8 11.5" />
          <circle cx="9.5" cy="10" r="1.8" />
          <path d="M11 11.2 L13.5 14" />
          <circle cx="15" cy="15.2" r="1.8" />
          <path d="M16.2 13.8 L20.5 8.5" />
          <path d="M16.5 8.5 H20.5 V12.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'elliott-wave':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polyline points="3,17 7.5,9 11.5,14 16,6 20.5,12" strokeLinecap="round" strokeLinejoin="round" />
          <text x="6.5" y="7.5" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="700">1</text>
          <text x="15" y="5" fill="currentColor" stroke="none" fontSize="6.5" fontWeight="700">3</text>
        </svg>
      );
    case 'time-cycles':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="5" y1="4" x2="5" y2="8.5" />
          <circle cx="5" cy="10.5" r="1.8" />
          <line x1="5" y1="12.5" x2="5" y2="20" />
          <line x1="10.5" y1="4" x2="10.5" y2="14.5" />
          <circle cx="10.5" cy="16.5" r="1.8" />
          <line x1="10.5" y1="18.5" x2="10.5" y2="20" />
          <line x1="6.3" y1="11.8" x2="9.3" y2="15.2" strokeDasharray="1.8 1.8" />
          <line x1="15" y1="4" x2="15" y2="20" />
          <line x1="19.5" y1="4" x2="19.5" y2="20" />
        </svg>
      );
    case 'long-position':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="8" fill="#089981" fillOpacity="0.32" stroke="#089981" />
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.8" />
          <rect x="4" y="12" width="16" height="8" fill="#f23645" fillOpacity="0.24" stroke="#f23645" />
        </svg>
      );
    case 'short-position':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="4" width="16" height="8" fill="#f23645" fillOpacity="0.24" stroke="#f23645" />
          <line x1="4" y1="12" x2="20" y2="12" strokeWidth="1.8" />
          <rect x="4" y="12" width="16" height="8" fill="#089981" fillOpacity="0.32" stroke="#089981" />
        </svg>
      );
    case 'price-range':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="4" y1="5" x2="20" y2="5" />
          <line x1="4" y1="19" x2="20" y2="19" />
          <line x1="12" y1="6.5" x2="12" y2="17.5" />
          <polyline points="9,9 12,6 15,9" />
        </svg>
      );
    case 'date-range':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="5" y1="4" x2="5" y2="20" />
          <line x1="19" y1="4" x2="19" y2="20" />
          <line x1="6.5" y1="12" x2="17.5" y2="12" />
          <polyline points="15,9 18,12 15,15" />
        </svg>
      );
    case 'measure':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="4,16 16,4 20,8 8,20" />
          <line x1="8" y1="12" x2="10" y2="14" />
          <line x1="11" y1="9" x2="13" y2="11" />
          <line x1="14" y1="6" x2="16" y2="8" />
        </svg>
      );
    case 'brush':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 17c3-5 6-5 8-1s5 3 8-3" strokeLinecap="round" />
        </svg>
      );
    case 'highlighter':
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M4 16c3-4 6-4 8-1s5 3 8-2" strokeLinecap="round" strokeOpacity="0.65" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="5.5" cy="18.5" r="2" />
          <line x1="7" y1="17" x2="17" y2="7" />
          <circle cx="18.5" cy="5.5" r="2" />
        </svg>
      );
  }
}

export const DEFAULT_FAVORITE_TOOLS: DrawingToolId[] = [
  'fib-levels',
  'liquidity-box',
  'text-note',
  'rectangle',
  'stop-channel',
  'volume-profile',
  'vertical-line',
  'horizontal-ray',
  'candle-pattern',
  'wave-path',
  'time-cycles',
  'trend-line',
];

export const FloatingFavoritesToolbar: React.FC<FloatingFavoritesToolbarProps> = ({
  activeTool,
  favoriteToolIds,
  onSelectTool,
  onQuickPlaceTool,
  visible,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 76, y: 10 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  if (!visible || favoriteToolIds.length === 0) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = moveEvt.clientX - dragRef.current.startX;
      const dy = dragRef.current.startY - moveEvt.clientY;
      setPos({
        x: Math.max(8, Math.min(window.innerWidth - 420, dragRef.current.origX + dx)),
        y: Math.max(4, Math.min(window.innerHeight - 100, dragRef.current.origY + dy)),
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={{ left: `${pos.x}px`, bottom: `${pos.y}px` }}
      className="absolute z-30 flex items-center tv-glass-popover border rounded-lg px-0.5 py-0.5 select-none"
      role="toolbar"
      aria-label="Favorite Drawing Tools"
    >
      {/* 6-Dot Drag Handle */}
      <button
        type="button"
        onMouseDown={handleMouseDown}
        aria-label="Drag Favorite Drawing Toolbar"
        title="Drag toolbar"
        className="flex items-center justify-center w-4 h-6 text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] cursor-grab active:cursor-grabbing shrink-0"
      >
        <svg viewBox="0 0 10 16" className="w-2 h-3" fill="currentColor">
          <circle cx="3" cy="3" r="1.1" />
          <circle cx="7" cy="3" r="1.1" />
          <circle cx="3" cy="8" r="1.1" />
          <circle cx="7" cy="8" r="1.1" />
          <circle cx="3" cy="13" r="1.1" />
          <circle cx="7" cy="13" r="1.1" />
        </svg>
      </button>

      {/* Favorite Drawing Tool Icons */}
      <div className="flex items-center gap-0.5">
        {favoriteToolIds.map((toolId) => {
          const isActive = activeTool === toolId;
          const label = getToolDisplayName(toolId);
          return (
            <button
              key={toolId}
              type="button"
              aria-label={label}
              title={`${label} — Click to draw on chart, double-click to auto-plot`}
              onClick={() => onSelectTool(isActive ? 'cursor' : toolId)}
              onDoubleClick={() => onQuickPlaceTool(toolId)}
              className={`flex items-center justify-center w-[25px] h-[24px] rounded-[4px] transition-colors shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px] ${
                isActive
                  ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                  : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
              }`}
            >
              {renderDrawingToolIcon(toolId)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
