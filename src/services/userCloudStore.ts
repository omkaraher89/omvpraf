// Local workspace cache. Accounts, sessions and the server copy of this snapshot
// live in Cloudflare D1 (see worker/index.ts + sql/schema.sql).

import type {
  AppThemeConfig,
  ChartDrawing,
  ChartPaneConfig,
  ChartSettingsConfig,
  DrawingTemplate,
  DrawingToolId,
  GexChartOverlayConfig,
  IndicatorConfig,
  LayoutSyncConfig,
  RightRailTab,
  VolumeProfileConfig,
} from '../types/trading';
import type { PriceAlert, TradePosition } from '../utils/marketEngine';

export const GUEST_WORKSPACE_STORAGE_KEY = 'tv_quant_guest_workspace_v2';

export interface WorkspacePreferencesState {
  appTheme: AppThemeConfig;
  chartCanvasTheme: 'light' | 'dark';
  chartSettings: ChartSettingsConfig;
  indicators: IndicatorConfig[];
  volumeProfileConfig: VolumeProfileConfig;
  gexOverlayConfig: GexChartOverlayConfig;
  watchlistSymbols: string[];
  customTimeframes: string[];
  layoutId: string;
  layoutSync: LayoutSyncConfig;
  panes: ChartPaneConfig[];
  activePaneId: string;
  favoriteToolIds: DrawingToolId[];
  favoritesBarVisible: boolean;
  magnetActive: boolean;
  stayInDrawingMode: boolean;
  drawingsLocked: boolean;
  drawingsHidden: boolean;
  ethSession: 'ETH' | 'RTH';
  backAdjusted: boolean;
  logScale: boolean;
  autoScale: boolean;
  timezoneId: string;
  rightPanelOpen: boolean;
  rightRailTab: RightRailTab;
}

export interface GuestWorkspaceSnapshot {
  preferences?: Partial<WorkspacePreferencesState>;
  drawings?: ChartDrawing[];
  drawingTemplates?: DrawingTemplate[];
  alerts?: PriceAlert[];
  positions?: TradePosition[];
}

export function loadGuestWorkspace(): GuestWorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(GUEST_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as GuestWorkspaceSnapshot;
  } catch {
    return null;
  }
}

export function saveGuestWorkspace(snapshot: GuestWorkspaceSnapshot): void {
  try {
    localStorage.setItem(GUEST_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota errors
  }
}
