import { AppThemeConfig, AppThemeId, ChartSettingsConfig, getDefaultChartSettings } from '../types/trading';

export const APP_THEME_STORAGE_KEY = 'tv_lse_app_theme_v1';
export const LAST_DARK_THEME_STORAGE_KEY = 'tv_lse_last_dark_theme_v1';

export const THEME_PRESETS: AppThemeConfig[] = [
  {
    id: 'obsidian-glass',
    name: 'Obsidian Glass',
    isLight: false,
    appBg: '#090a0f',
    panelBg: '#0e1118',
    elevatedBg: '#171b26',
    inputBg: '#0c0f16',
    borderColor: '#262b38',
    textPrimary: '#eef1f7',
    textSecondary: '#b2b7c4',
    textMuted: '#7a8091',
    accentColor: '#2962ff',
    bullColor: '#089981',
    bearColor: '#f23645',
    chartBg: '#0c0f17',
    chartGridColor: '#191e2b',
    glassOpacity: 0.72,
    glassBlurPx: 18,
    chartBgOpacity: 0.86,
    wallpaperMode: 'aurora',
    wallpaperOpacity: 0.58,
    wallpaperSpeed: 1.0,
    wallpaperColors: ['#2962ff', '#089981', '#6366f1'],
  },
  {
    id: 'midnight-aurora',
    name: 'Midnight Nebula',
    isLight: false,
    appBg: '#060814',
    panelBg: '#0c1124',
    elevatedBg: '#161e3a',
    inputBg: '#090d1c',
    borderColor: '#273154',
    textPrimary: '#f1f5ff',
    textSecondary: '#aab6d6',
    textMuted: '#6f7ca1',
    accentColor: '#38bdf8',
    bullColor: '#10b981',
    bearColor: '#fb7185',
    chartBg: '#080c1b',
    chartGridColor: '#17203a',
    glassOpacity: 0.68,
    glassBlurPx: 22,
    chartBgOpacity: 0.82,
    wallpaperMode: 'constellation',
    wallpaperOpacity: 0.68,
    wallpaperSpeed: 1.0,
    wallpaperColors: ['#38bdf8', '#818cf8', '#c084fc'],
  },
  {
    id: 'emerald-quant',
    name: 'Emerald Quant',
    isLight: false,
    appBg: '#050c0a',
    panelBg: '#0a1612',
    elevatedBg: '#12241e',
    inputBg: '#07110e',
    borderColor: '#1e3830',
    textPrimary: '#ecfdf5',
    textSecondary: '#9ec4b7',
    textMuted: '#63887b',
    accentColor: '#10b981',
    bullColor: '#10b981',
    bearColor: '#f43f5e',
    chartBg: '#07110e',
    chartGridColor: '#132720',
    glassOpacity: 0.74,
    glassBlurPx: 18,
    chartBgOpacity: 0.85,
    wallpaperMode: 'grid-drift',
    wallpaperOpacity: 0.62,
    wallpaperSpeed: 0.9,
    wallpaperColors: ['#10b981', '#14b8a6', '#22d3ee'],
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    isLight: false,
    appBg: '#0d070a',
    panelBg: '#160d12',
    elevatedBg: '#23151d',
    inputBg: '#10090d',
    borderColor: '#3a212e',
    textPrimary: '#fdf2f5',
    textSecondary: '#cba9b6',
    textMuted: '#8a6876',
    accentColor: '#f43f5e',
    bullColor: '#10b981',
    bearColor: '#f43f5e',
    chartBg: '#10090d',
    chartGridColor: '#25151e',
    glassOpacity: 0.72,
    glassBlurPx: 20,
    chartBgOpacity: 0.84,
    wallpaperMode: 'pulse',
    wallpaperOpacity: 0.64,
    wallpaperSpeed: 1.0,
    wallpaperColors: ['#f43f5e', '#f59e0b', '#a855f7'],
  },
  {
    id: 'sapphire-horizon',
    name: 'Sapphire Horizon',
    isLight: false,
    appBg: '#070d17',
    panelBg: '#0e1726',
    elevatedBg: '#182438',
    inputBg: '#0a111d',
    borderColor: '#263652',
    textPrimary: '#eff6ff',
    textSecondary: '#a7bad6',
    textMuted: '#6d82a3',
    accentColor: '#3b82f6',
    bullColor: '#22c55e',
    bearColor: '#ef4444',
    chartBg: '#0a111d',
    chartGridColor: '#162236',
    glassOpacity: 0.74,
    glassBlurPx: 18,
    chartBgOpacity: 0.85,
    wallpaperMode: 'aurora',
    wallpaperOpacity: 0.62,
    wallpaperSpeed: 0.95,
    wallpaperColors: ['#3b82f6', '#06b6d4', '#6366f1'],
  },
  {
    id: 'amber-terminal',
    name: 'Bloomberg Amber',
    isLight: false,
    appBg: '#0b0905',
    panelBg: '#141009',
    elevatedBg: '#20190d',
    inputBg: '#0f0c06',
    borderColor: '#362a16',
    textPrimary: '#fdf8ee',
    textSecondary: '#d1be9a',
    textMuted: '#948160',
    accentColor: '#f59e0b',
    bullColor: '#22c55e',
    bearColor: '#ef4444',
    chartBg: '#0f0c06',
    chartGridColor: '#221b0f',
    glassOpacity: 0.76,
    glassBlurPx: 16,
    chartBgOpacity: 0.88,
    wallpaperMode: 'grid-drift',
    wallpaperOpacity: 0.56,
    wallpaperSpeed: 0.85,
    wallpaperColors: ['#f59e0b', '#ea580c', '#eab308'],
  },
  {
    id: 'cyber-violet',
    name: 'Ultraviolet Glass',
    isLight: false,
    appBg: '#090612',
    panelBg: '#120c22',
    elevatedBg: '#1d1435',
    inputBg: '#0d0919',
    borderColor: '#322457',
    textPrimary: '#f5f2ff',
    textSecondary: '#beb2de',
    textMuted: '#8274a8',
    accentColor: '#a855f7',
    bullColor: '#2dd4bf',
    bearColor: '#fb7185',
    chartBg: '#0d081a',
    chartGridColor: '#1e1538',
    glassOpacity: 0.68,
    glassBlurPx: 22,
    chartBgOpacity: 0.82,
    wallpaperMode: 'prism-waves',
    wallpaperOpacity: 0.66,
    wallpaperSpeed: 1.0,
    wallpaperColors: ['#a855f7', '#38bdf8', '#ec4899'],
  },
  {
    id: 'nordic-slate',
    name: 'Nordic Slate',
    isLight: false,
    appBg: '#141923',
    panelBg: '#1c2330',
    elevatedBg: '#263042',
    inputBg: '#171d28',
    borderColor: '#364257',
    textPrimary: '#edf2f9',
    textSecondary: '#b4c0d4',
    textMuted: '#7e8da6',
    accentColor: '#60a5fa',
    bullColor: '#34d399',
    bearColor: '#f87171',
    chartBg: '#171d28',
    chartGridColor: '#242e40',
    glassOpacity: 0.78,
    glassBlurPx: 16,
    chartBgOpacity: 0.88,
    wallpaperMode: 'starfield',
    wallpaperOpacity: 0.58,
    wallpaperSpeed: 0.8,
    wallpaperColors: ['#60a5fa', '#818cf8', '#38bdf8'],
  },
  {
    id: 'tokyo-carbon',
    name: 'Tokyo Carbon',
    isLight: false,
    appBg: '#050507',
    panelBg: '#0c0d11',
    elevatedBg: '#15171e',
    inputBg: '#090a0d',
    borderColor: '#252834',
    textPrimary: '#f3f4f8',
    textSecondary: '#a6aab8',
    textMuted: '#6d7280',
    accentColor: '#06b6d4',
    bullColor: '#14b8a6',
    bearColor: '#ff5266',
    chartBg: '#07080b',
    chartGridColor: '#151821',
    glassOpacity: 0.74,
    glassBlurPx: 20,
    chartBgOpacity: 0.86,
    wallpaperMode: 'starfield',
    wallpaperOpacity: 0.64,
    wallpaperSpeed: 0.9,
    wallpaperColors: ['#06b6d4', '#14b8a6', '#f43f5e'],
  },
  {
    id: 'arctic-daylight',
    name: 'Arctic Daylight',
    isLight: true,
    appBg: '#e4ebf5',
    panelBg: '#ffffff',
    elevatedBg: '#f3f6fb',
    inputBg: '#ffffff',
    borderColor: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    accentColor: '#2962ff',
    bullColor: '#089981',
    bearColor: '#f23645',
    chartBg: '#ffffff',
    chartGridColor: '#edf1f7',
    glassOpacity: 0.78,
    glassBlurPx: 18,
    chartBgOpacity: 0.88,
    wallpaperMode: 'aurora',
    wallpaperOpacity: 0.45,
    wallpaperSpeed: 0.85,
    wallpaperColors: ['#60a5fa', '#34d399', '#a78bfa'],
  },
  {
    id: 'warm-alabaster',
    name: 'Warm Alabaster',
    isLight: true,
    appBg: '#ede7dc',
    panelBg: '#faf7f2',
    elevatedBg: '#f3ede3',
    inputBg: '#ffffff',
    borderColor: '#d6ccb9',
    textPrimary: '#1f1a14',
    textSecondary: '#574d40',
    textMuted: '#7a6e5e',
    accentColor: '#c2410c',
    bullColor: '#0f766e',
    bearColor: '#dc2626',
    chartBg: '#fcfaf6',
    chartGridColor: '#eee8dc',
    glassOpacity: 0.82,
    glassBlurPx: 14,
    chartBgOpacity: 0.92,
    wallpaperMode: 'prism-waves',
    wallpaperOpacity: 0.36,
    wallpaperSpeed: 0.75,
    wallpaperColors: ['#f59e0b', '#ea580c', '#0d9488'],
  },
  {
    id: 'sage-daylight',
    name: 'Sage Daylight',
    isLight: true,
    appBg: '#dfeae4',
    panelBg: '#f7fbf9',
    elevatedBg: '#ebf4ef',
    inputBg: '#ffffff',
    borderColor: '#bfd4c8',
    textPrimary: '#0f241c',
    textSecondary: '#3b594d',
    textMuted: '#5b7a6d',
    accentColor: '#059669',
    bullColor: '#059669',
    bearColor: '#e11d48',
    chartBg: '#fbfefd',
    chartGridColor: '#e6f0eb',
    glassOpacity: 0.8,
    glassBlurPx: 16,
    chartBgOpacity: 0.9,
    wallpaperMode: 'aurora',
    wallpaperOpacity: 0.4,
    wallpaperSpeed: 0.8,
    wallpaperColors: ['#10b981', '#0ea5e9', '#14b8a6'],
  },
];

export const DEFAULT_APP_THEME: AppThemeConfig = THEME_PRESETS[0];

export function getPresetById(id: AppThemeId): AppThemeConfig {
  return THEME_PRESETS.find((t) => t.id === id) || DEFAULT_APP_THEME;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '').trim().replace('#', '');
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return { r: 16, g: 20, b: 28 };
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1));
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(3)})`;
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function getContrastText(hex: string): string {
  return getRelativeLuminance(hex) > 0.44 ? '#0a0d14' : '#ffffff';
}

export function buildThemeCssVars(theme: AppThemeConfig): Record<string, string> {
  const glassOp = Math.max(0.3, Math.min(0.98, theme.glassOpacity));
  const blurPx = Math.max(0, Math.min(36, theme.glassBlurPx));
  const popoverOp = Math.min(0.97, glassOp + (theme.isLight ? 0.14 : 0.16));
  const elevatedOp = Math.min(0.95, glassOp + 0.1);
  const inputOp = Math.min(0.96, glassOp + 0.12);

  return {
    '--tv-bg-app': theme.appBg,
    '--tv-bg-bar': hexToRgba(theme.panelBg, glassOp),
    '--tv-bg-panel': hexToRgba(theme.panelBg, Math.min(0.96, glassOp + 0.04)),
    '--tv-bg-popover': hexToRgba(theme.elevatedBg, popoverOp),
    '--tv-bg-elevated': hexToRgba(theme.elevatedBg, elevatedOp),
    '--tv-bg-hover': theme.isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.08)',
    '--tv-bg-active': hexToRgba(theme.elevatedBg, 0.92),
    '--tv-bg-input': hexToRgba(theme.inputBg, inputOp),
    '--tv-border': hexToRgba(theme.borderColor, theme.isLight ? 0.85 : 0.78),
    '--tv-border-glass': theme.isLight
      ? 'rgba(15, 23, 42, 0.14)'
      : 'rgba(255, 255, 255, 0.13)',
    '--tv-text': theme.textPrimary,
    '--tv-text-secondary': theme.textSecondary,
    '--tv-text-muted': theme.textMuted,
    '--tv-accent': theme.accentColor,
    '--tv-accent-soft': hexToRgba(theme.accentColor, 0.18),
    '--tv-accent-border': hexToRgba(theme.accentColor, 0.48),
    '--tv-accent-contrast': getContrastText(theme.accentColor),
    '--tv-bull': theme.bullColor,
    '--tv-bull-soft': hexToRgba(theme.bullColor, 0.16),
    '--tv-bear': theme.bearColor,
    '--tv-bear-soft': hexToRgba(theme.bearColor, 0.16),
    '--tv-chart-bg': theme.chartBg,
    '--tv-chart-grid': theme.chartGridColor,
    '--tv-blur': `${blurPx}px`,
    '--tv-shadow': theme.isLight
      ? '0 20px 55px rgba(15, 23, 42, 0.15)'
      : '0 24px 70px rgba(0, 0, 0, 0.72)',
  };
}

export function applyThemeCssVars(theme: AppThemeConfig, root?: HTMLElement | null): void {
  const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
  if (!target) return;
  const vars = buildThemeCssVars(theme);
  for (const [k, v] of Object.entries(vars)) {
    target.style.setProperty(k, v);
  }
  target.classList.toggle('dark', !theme.isLight);
  target.dataset.themeMode = theme.isLight ? 'light' : 'dark';
}

export function resolveEffectiveChartBgColor(
  theme: AppThemeConfig | undefined,
  fallbackHex: string
): string {
  if (!theme) return fallbackHex;
  if (theme.wallpaperMode === 'none') return fallbackHex;
  const op = Math.max(0.45, Math.min(1, theme.chartBgOpacity));
  if (op >= 0.995) return fallbackHex;
  return hexToRgba(fallbackHex, op);
}

export function syncChartSettingsWithAppTheme(
  prevSettings: ChartSettingsConfig,
  theme: AppThemeConfig,
  forceChartColors = false
): ChartSettingsConfig {
  const baseDefaults = getDefaultChartSettings(theme.isLight ? 'light' : 'dark');
  return {
    ...prevSettings,
    // Candle colours only change when explicitly forced (e.g. an explicit reset),
    // never as a side effect of picking a theme.
    ...(forceChartColors
      ? {
          bodyUpColor: theme.bullColor,
          bodyDownColor: theme.bearColor,
          borderUpColor: theme.bullColor,
          borderDownColor: theme.bearColor,
          wickUpColor: theme.bullColor,
          wickDownColor: theme.bearColor,
        }
      : {}),
    ...(forceChartColors || !prevSettings.useCustomCanvasColors
      ? {
          bgType: 'Solid',
          bgColor: theme.chartBg,
          bgColorBottom: theme.appBg,
          vertGridColor: theme.chartGridColor,
          horzGridColor: theme.chartGridColor,
          crosshairColor: theme.isLight ? '#64748b' : '#5d606b',
          watermarkColor: theme.isLight
            ? 'rgba(15, 23, 42, 0.08)'
            : 'rgba(224, 227, 235, 0.07)',
          scalesTextColor: theme.textMuted || baseDefaults.scalesTextColor,
          scalesLinesColor: theme.borderColor || baseDefaults.scalesLinesColor,
        }
      : {}),
  };
}

export function loadSavedAppTheme(): AppThemeConfig {
  try {
    const raw = localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_THEME;
    const parsed = JSON.parse(raw) as Partial<AppThemeConfig>;
    const base = parsed.id && parsed.id !== 'custom' ? getPresetById(parsed.id) : DEFAULT_APP_THEME;
    return {
      ...base,
      ...parsed,
      wallpaperColors:
        Array.isArray(parsed.wallpaperColors) && parsed.wallpaperColors.length === 3
          ? (parsed.wallpaperColors as [string, string, string])
          : base.wallpaperColors,
    };
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function saveAppTheme(theme: AppThemeConfig): void {
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, JSON.stringify(theme));
    if (!theme.isLight) {
      localStorage.setItem(LAST_DARK_THEME_STORAGE_KEY, JSON.stringify(theme));
    }
  } catch {
    // ignore storage errors
  }
}

export function loadLastDarkTheme(): AppThemeConfig {
  try {
    const raw = localStorage.getItem(LAST_DARK_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_THEME;
    const parsed = JSON.parse(raw) as Partial<AppThemeConfig>;
    return {
      ...DEFAULT_APP_THEME,
      ...parsed,
      isLight: false,
    };
  } catch {
    return DEFAULT_APP_THEME;
  }
}
