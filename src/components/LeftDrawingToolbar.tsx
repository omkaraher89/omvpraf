import React, { useState, useRef, useEffect } from 'react';
import {
  Crosshair,
  TrendingUp,
  Sliders,
  Share2,
  GitCommit,
  Brush,
  Type,
  Heart,
  Ruler,
  ZoomIn,
  Magnet,
  Edit3,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Star,
  ChevronRight,
} from 'lucide-react';
import { DrawingToolId } from '../types/trading';
import { renderDrawingToolIcon } from './FloatingFavoritesToolbar';

interface LeftDrawingToolbarProps {
  activeTool: DrawingToolId;
  onSelectTool: (tool: DrawingToolId) => void;
  favoritesBarVisible: boolean;
  onToggleFavoritesBar: () => void;
  favoriteToolIds: DrawingToolId[];
  onToggleFavoriteTool: (tool: DrawingToolId) => void;
  magnetActive: boolean;
  onToggleMagnet: () => void;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  drawingsLocked: boolean;
  onToggleLockDrawings: () => void;
  drawingsHidden: boolean;
  onToggleHideDrawings: () => void;
  onClearDrawings: () => void;
  onZoomIn: () => void;
}

interface ToolGroupItem {
  id: DrawingToolId;
  label: string;
  shortcut?: string;
}

interface ToolGroupConfig {
  groupId: string;
  label: string;
  defaultTool: DrawingToolId;
  icon: React.ReactNode;
  tools: ToolGroupItem[];
}

const TOOL_GROUPS: ToolGroupConfig[] = [
  {
    groupId: 'cursor',
    label: 'Crosshair',
    defaultTool: 'cursor',
    icon: <Crosshair className="w-[18px] h-[18px]" />,
    tools: [{ id: 'cursor', label: 'Crosshair', shortcut: 'Esc' }],
  },
  {
    groupId: 'lines',
    label: 'Trend Line Tools',
    defaultTool: 'trend-line',
    icon: <TrendingUp className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'trend-line', label: 'Trend Line', shortcut: 'Alt+T' },
      { id: 'ray', label: 'Ray' },
      { id: 'info-line', label: 'Info Line' },
      { id: 'extended-line', label: 'Extended Line' },
      { id: 'horizontal-line', label: 'Horizontal Line', shortcut: 'Alt+H' },
      { id: 'horizontal-ray', label: 'Horizontal Ray', shortcut: 'Alt+J' },
      { id: 'vertical-line', label: 'Vertical Line', shortcut: 'Alt+V' },
      { id: 'cross-line', label: 'Cross Line', shortcut: 'Alt+C' },
      { id: 'parallel-channel', label: 'Parallel Channel' },
      { id: 'liquidity-box', label: 'Liquidity Pool Channel (L)' },
      { id: 'stop-channel', label: 'Settlement / Stop Zone (S)' },
    ],
  },
  {
    groupId: 'fib',
    label: 'Gann and Fibonacci Tools',
    defaultTool: 'fib-levels',
    icon: <Sliders className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'fib-levels', label: 'Fib Retracement', shortcut: 'Alt+F' },
      { id: 'fib-extension', label: 'Trend-Based Fib Extension' },
      { id: 'pitchfork', label: 'Andrews Pitchfork' },
      { id: 'time-cycles', label: 'Fib Time Zones' },
    ],
  },
  {
    groupId: 'patterns',
    label: 'Patterns & Waves',
    defaultTool: 'wave-path',
    icon: <Share2 className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'wave-path', label: 'Polyline / Path' },
      { id: 'elliott-wave', label: 'Elliott Impulse Wave (12345)' },
      { id: 'candle-pattern', label: 'Bars Pattern' },
    ],
  },
  {
    groupId: 'prediction',
    label: 'Prediction and Measurement Tools',
    defaultTool: 'long-position',
    icon: <GitCommit className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'long-position', label: 'Long Position (Risk/Reward)' },
      { id: 'short-position', label: 'Short Position (Risk/Reward)' },
      { id: 'price-range', label: 'Price Range' },
      { id: 'date-range', label: 'Date Range' },
      { id: 'volume-profile', label: 'Fixed Range Volume Profile' },
    ],
  },
  {
    groupId: 'shapes',
    label: 'Brush & Geometric Shapes',
    defaultTool: 'rectangle',
    icon: <Brush className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'brush', label: 'Brush' },
      { id: 'highlighter', label: 'Highlighter' },
      { id: 'rectangle', label: 'Rectangle', shortcut: 'Alt+R' },
      { id: 'circle', label: 'Circle / Ellipse' },
      { id: 'triangle', label: 'Triangle' },
    ],
  },
  {
    groupId: 'annotation',
    label: 'Annotation & Text',
    defaultTool: 'text-note',
    icon: <Type className="w-[18px] h-[18px]" />,
    tools: [
      { id: 'text-note', label: 'Text' },
      { id: 'callout', label: 'Callout' },
      { id: 'price-label', label: 'Price Note' },
    ],
  },
];

export const LeftDrawingToolbar: React.FC<LeftDrawingToolbarProps> = ({
  activeTool,
  onSelectTool,
  favoritesBarVisible,
  onToggleFavoritesBar,
  favoriteToolIds,
  onToggleFavoriteTool,
  magnetActive,
  onToggleMagnet,
  stayInDrawingMode,
  onToggleStayInDrawingMode,
  drawingsLocked,
  onToggleLockDrawings,
  drawingsHidden,
  onToggleHideDrawings,
  onClearDrawings,
  onZoomIn,
}) => {
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState<number>(48);
  const [groupLastTool, setGroupLastTool] = useState<Record<string, DrawingToolId>>({});
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setOpenFlyout(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSelectFromGroup = (groupId: string, toolId: DrawingToolId) => {
    setGroupLastTool((prev) => ({ ...prev, [groupId]: toolId }));
    onSelectTool(toolId);
    setOpenFlyout(null);
  };

  const toggleGroupFlyout = (groupId: string, anchorEl: HTMLElement) => {
    if (openFlyout === groupId) {
      setOpenFlyout(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    const maxTop = typeof window !== 'undefined' ? Math.max(40, window.innerHeight - 280) : rect.top;
    setFlyoutTop(Math.min(rect.top, maxTop));
    setOpenFlyout(groupId);
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Drawing Tools Sidebar"
      className="relative w-[38px] tv-glass-bar border-r flex flex-col items-center py-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] justify-between select-none shrink-0 z-30 overflow-y-auto no-scrollbar"
    >
      <div className="flex flex-col items-center gap-0.5 w-full shrink-0">
        {TOOL_GROUPS.map((group) => {
          const currentGroupTool = groupLastTool[group.groupId] || group.defaultTool;
          const isActive = group.tools.some((t) => t.id === activeTool);
          const hasSubmenu = group.tools.length > 1;
          const flyoutVisible = openFlyout === group.groupId;

          return (
            <div key={group.groupId} className="relative flex items-center justify-center w-full group/btn">
              <button
                type="button"
                onClick={(ev) => {
                  if (group.groupId === 'cursor') {
                    onSelectTool('cursor');
                    setOpenFlyout(null);
                  } else if (isActive && hasSubmenu) {
                    toggleGroupFlyout(group.groupId, ev.currentTarget);
                  } else {
                    onSelectTool(currentGroupTool);
                    setOpenFlyout(null);
                  }
                }}
                aria-label={group.label}
                title={group.label}
                className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors [&>svg]:w-[15px] [&>svg]:h-[15px] ${
                  isActive
                    ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)] border border-[var(--tv-accent-border)]'
                    : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
                }`}
              >
                {group.groupId === 'cursor'
                  ? group.icon
                  : renderDrawingToolIcon(isActive ? activeTool : currentGroupTool)}
              </button>

              {/* TradingView corner flyout arrow on tool groups */}
              {hasSubmenu && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    toggleGroupFlyout(group.groupId, ev.currentTarget);
                  }}
                  aria-label={`Open ${group.label} menu`}
                  className="absolute right-0.5 bottom-0 w-2.5 h-2.5 flex items-center justify-center text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] opacity-70 group-hover/btn:opacity-100"
                >
                  <ChevronRight className="w-2.5 h-2.5" />
                </button>
              )}

              {/* Flyout Submenu */}
              {flyoutVisible && hasSubmenu && (
                <div
                  role="menu"
                  aria-label={`${group.label} submenu`}
                  style={{ top: `${flyoutTop}px`, left: '40px' }}
                  className="fixed w-60 max-h-[75dvh] overflow-y-auto tv-glass-popover border rounded-xl py-1 z-50"
                >
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)] border-b border-[var(--tv-border)] mb-0.5">
                    {group.label}
                  </div>
                  {group.tools.map((item) => {
                    const isItemActive = activeTool === item.id;
                    const isFav = favoriteToolIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between px-2 py-1 text-[11.5px] transition-colors ${
                          isItemActive
                            ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
                            : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectFromGroup(group.groupId, item.id)}
                          className="flex items-center gap-2 flex-1 text-left"
                        >
                          <span className="shrink-0 [&>svg]:w-[15px] [&>svg]:h-[15px]">{renderDrawingToolIcon(item.id)}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                        <div className="flex items-center gap-1 ml-1.5 shrink-0">
                          {item.shortcut && (
                            <span
                              className={`text-[9.5px] font-mono ${
                                isItemActive ? 'opacity-80' : 'text-[var(--tv-text-muted)]'
                              }`}
                            >
                              {item.shortcut}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              onToggleFavoriteTool(item.id);
                            }}
                            aria-label={`${isFav ? 'Remove' : 'Add'} ${item.label} to Favorites`}
                            title={isFav ? 'Remove from Favorites bar' : 'Add to Favorites bar'}
                            className={`p-0.5 rounded ${
                              isFav
                                ? 'text-[#f7931a]'
                                : isItemActive
                                ? 'opacity-70 hover:opacity-100'
                                : 'text-[var(--tv-text-muted)] hover:text-[#f7931a]'
                            }`}
                          >
                            <Star className={`w-3 h-3 ${isFav ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Favorites Heart Icon (Toggles Floating Favorites Toolbar) */}
        <button
          type="button"
          onClick={onToggleFavoritesBar}
          aria-label="Toggle Favorite Drawing Tools Toolbar"
          title="Show/Hide Favorite Drawing Tools Toolbar"
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            favoritesBarVisible
              ? 'text-[#f7931a] bg-[var(--tv-bg-hover)]'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <Heart className="w-[15px] h-[15px]" />
        </button>

        <div className="w-5 h-[1px] bg-[var(--tv-border)] my-0.5" />

        {/* Measure Tool */}
        <button
          type="button"
          onClick={() => onSelectTool(activeTool === 'measure' ? 'cursor' : 'measure')}
          aria-label="Measure Price and Time Range"
          title="Measure (Shift + Click)"
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            activeTool === 'measure'
              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <Ruler className="w-[15px] h-[15px]" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom In Chart"
          title="Zoom In"
          className="w-[28px] h-[28px] rounded-[4px] flex items-center justify-center text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)] transition-colors"
        >
          <ZoomIn className="w-[15px] h-[15px]" />
        </button>

        <div className="w-5 h-[1px] bg-[var(--tv-border)] my-0.5" />

        {/* Magnet Mode */}
        <button
          type="button"
          onClick={onToggleMagnet}
          aria-label="Magnet Mode"
          title={magnetActive ? 'Strong Magnet Mode Enabled (Snaps to OHLC)' : 'Enable Magnet Mode'}
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            magnetActive
              ? 'bg-[var(--tv-text)] text-[var(--tv-bg-app)] shadow-sm'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <Magnet className="w-[15px] h-[15px] -rotate-45" />
        </button>

        {/* Stay in Drawing Mode */}
        <button
          type="button"
          onClick={onToggleStayInDrawingMode}
          aria-label="Stay in Drawing Mode"
          title="Stay in Drawing Mode"
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            stayInDrawingMode
              ? 'bg-[var(--tv-accent)] text-[var(--tv-accent-contrast)]'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          <Edit3 className="w-[14px] h-[14px]" />
        </button>

        {/* Lock All Drawings */}
        <button
          type="button"
          onClick={onToggleLockDrawings}
          aria-label="Lock All Drawing Tools"
          title={drawingsLocked ? 'Unlock All Drawings' : 'Lock All Drawings'}
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            drawingsLocked
              ? 'bg-[var(--tv-accent-soft)] text-[var(--tv-accent)]'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          {drawingsLocked ? <Lock className="w-[14px] h-[14px]" /> : <Unlock className="w-[14px] h-[14px]" />}
        </button>

        {/* Hide All Drawings */}
        <button
          type="button"
          onClick={onToggleHideDrawings}
          aria-label="Hide All Drawings"
          title={drawingsHidden ? 'Show All Drawings' : 'Hide All Drawings'}
          className={`w-[28px] h-[28px] rounded-[4px] flex items-center justify-center transition-colors ${
            drawingsHidden
              ? 'bg-[var(--tv-bg-active)] text-[#f59e0b]'
              : 'text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-text)]'
          }`}
        >
          {drawingsHidden ? <EyeOff className="w-[14px] h-[14px]" /> : <Eye className="w-[14px] h-[14px]" />}
        </button>
      </div>

      {/* Bottom Trash / Remove Objects Icon */}
      <div className="pt-1 border-t border-[var(--tv-border)] w-full flex justify-center">
        <button
          type="button"
          onClick={onClearDrawings}
          aria-label="Remove Drawings"
          title="Remove all user drawings"
          className="w-[28px] h-[28px] rounded-[4px] flex items-center justify-center text-[var(--tv-text-secondary)] hover:bg-[var(--tv-bg-hover)] hover:text-[var(--tv-bear)] transition-colors"
        >
          <Trash2 className="w-[14px] h-[14px]" />
        </button>
      </div>
    </aside>
  );
};
