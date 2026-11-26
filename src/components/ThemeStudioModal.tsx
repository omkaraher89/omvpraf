import React, { useState, useEffect } from 'react';
import { X, Palette, Sparkles, Sliders, RotateCcw, Check, Sun, Moon } from 'lucide-react';
import { AppThemeConfig, LiveWallpaperMode } from '../types/trading';
import { THEME_PRESETS, DEFAULT_APP_THEME, getPresetById, getContrastText } from '../utils/themeEngine';

interface ThemeStudioModalProps {
  open: boolean;
  theme: AppThemeConfig;
  onUpdateTheme: (next: AppThemeConfig, forceChartColors?: boolean) => void;
  onClose: () => void;
}

type StudioTab = 'presets' | 'wallpaper' | 'glass_custom';
type PresetFilter = 'all' | 'dark' | 'light';

const WALLPAPER_MODES: Array<{ id: LiveWallpaperMode; label: string; desc: string }> = [
  { id: 'none', label: 'Solid / Off', desc: 'Clean static backdrop without motion' },
  { id: 'aurora', label: 'Aurora Mesh', desc: 'Smooth drifting ambient gradient orbs' },
  { id: 'constellation', label: 'Constellation', desc: 'Interactive liquidity node filaments' },
  { id: 'pulse', label: 'Nebula Pulse', desc: 'Harmonic waves & horizon ribbons' },
  { id: 'grid-drift', label: 'Grid Drift', desc: 'Architectural quant matrix & beacons' },
  { id: 'prism-waves', label: 'Prism Waves', desc: 'Layered silk spectrum horizon ribbons' },
  { id: 'starfield', label: 'Deep Space', desc: 'Drifting parallax starfield & nebula glow' },
];

const ColorField: React.FC<{
  label: string;
  value: string;
  onChange: (hex: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg tv-glass-card border cursor-pointer hover:opacity-95 transition-opacity">
    <span className="text-[11.5px] font-medium text-[var(--tv-text-secondary)] truncate">
      {label}
    </span>
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-[10.5px] font-mono tabular-nums text-[var(--tv-text-muted)] uppercase">
        {value}
      </span>
      <span className="relative w-6 h-5 rounded border border-[var(--tv-border-glass)] overflow-hidden shadow-xs">
        <span className="absolute inset-0" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value.startsWith('#') && value.length === 7 ? value : '#2962ff'}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </span>
    </div>
  </label>
);

export const ThemeStudioModal: React.FC<ThemeStudioModalProps> = ({
  open,
  theme,
  onUpdateTheme,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('presets');
  const [presetFilter, setPresetFilter] = useState<PresetFilter>('all');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const updateCustom = (patch: Partial<AppThemeConfig>, forceChartColors = true) => {
    onUpdateTheme(
      {
        ...theme,
        ...patch,
        id: 'custom',
        name: 'Custom Studio',
      },
      forceChartColors
    );
  };

  const togglePolarity = (nextIsLight: boolean) => {
    if (nextIsLight === theme.isLight) return;
    const ref = nextIsLight ? getPresetById('arctic-daylight') : DEFAULT_APP_THEME;
    updateCustom(
      {
        isLight: nextIsLight,
        appBg: ref.appBg,
        panelBg: ref.panelBg,
        elevatedBg: ref.elevatedBg,
        inputBg: ref.inputBg,
        borderColor: ref.borderColor,
        textPrimary: ref.textPrimary,
        textSecondary: ref.textSecondary,
        textMuted: ref.textMuted,
        chartBg: ref.chartBg,
        chartGridColor: ref.chartGridColor,
      },
      true
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Theme, Glass UI & Live Wallpaper Studio"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[780px] max-h-[88vh] rounded-2xl tv-glass-popover border flex flex-col overflow-hidden text-[var(--tv-text)]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--tv-border-glass)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-[var(--tv-border-glass)]"
              style={{
                backgroundColor: 'var(--tv-accent-soft)',
                color: 'var(--tv-accent)',
              }}
            >
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--tv-text)]">
                Theme, Glass UI &amp; Live Wallpaper Studio
              </h2>
              <p className="text-[11px] text-[var(--tv-text-muted)]">
                Active: <span className="font-semibold text-[var(--tv-text-secondary)]">{theme.name}</span> ·{' '}
                {theme.isLight ? 'Light' : 'Dark'} · Glass {Math.round(theme.glassOpacity * 100)}% /{' '}
                {theme.glassBlurPx}px blur
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Theme Studio"
            className="p-1.5 rounded-lg text-[var(--tv-text-muted)] hover:text-[var(--tv-text)] hover:bg-[var(--tv-bg-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-5 pt-2.5 pb-0 border-b border-[var(--tv-border-glass)] flex items-center gap-1.5 shrink-0">
          {(
            [
              { id: 'presets', label: 'Theme Presets', icon: <Palette className="w-3.5 h-3.5" /> },
              { id: 'wallpaper', label: 'Live Wallpaper', icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'glass_custom', label: 'Glass & Custom Colors', icon: <Sliders className="w-3.5 h-3.5" /> },
            ] as Array<{ id: StudioTab; label: string; icon: React.ReactNode }>
          ).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 text-[12px] font-medium flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[var(--tv-accent)] text-[var(--tv-text)]'
                    : 'border-transparent text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'presets' && (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11.5px] text-[var(--tv-text-muted)]">
                  {THEME_PRESETS.length} institutional dark &amp; daylight themes with synced charts
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--tv-border-glass)] bg-[var(--tv-bg-input)]">
                  {(
                    [
                      { id: 'all', label: `All (${THEME_PRESETS.length})` },
                      { id: 'dark', label: `Dark (${THEME_PRESETS.filter((p) => !p.isLight).length})` },
                      { id: 'light', label: `Light (${THEME_PRESETS.filter((p) => p.isLight).length})` },
                    ] as Array<{ id: PresetFilter; label: string }>
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPresetFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                        presetFilter === f.id
                          ? 'font-semibold'
                          : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                      }`}
                      style={
                        presetFilter === f.id
                          ? {
                              backgroundColor: 'var(--tv-accent)',
                              color: 'var(--tv-accent-contrast)',
                            }
                          : undefined
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {THEME_PRESETS.filter((p) =>
                  presetFilter === 'all' ? true : presetFilter === 'light' ? p.isLight : !p.isLight
                ).map((preset) => {
                  const isActive = theme.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onUpdateTheme({ ...preset }, true)}
                      className={`group text-left rounded-xl border p-3 transition-all ${
                        isActive
                          ? 'ring-2 ring-[var(--tv-accent)] border-[var(--tv-accent)]'
                          : 'border-[var(--tv-border-glass)] hover:border-[var(--tv-accent-border)]'
                      }`}
                      style={{ backgroundColor: preset.panelBg, color: preset.textPrimary }}
                    >
                      {/* Mini Live Wallpaper + Chart Preview */}
                      <div
                        className="h-16 rounded-lg mb-2.5 relative overflow-hidden border"
                        style={{
                          backgroundColor: preset.appBg,
                          borderColor: preset.borderColor,
                        }}
                      >
                        <div
                          className="absolute inset-0 opacity-75"
                          style={{
                            background: `radial-gradient(circle at 20% 30%, ${preset.wallpaperColors[0]}55, transparent 60%), radial-gradient(circle at 80% 70%, ${preset.wallpaperColors[1]}44, transparent 60%), radial-gradient(circle at 55% 45%, ${preset.wallpaperColors[2]}33, transparent 65%)`,
                          }}
                        />
                        {/* Mini frosted bars & candles silhouette */}
                        <div
                          className="absolute inset-x-1.5 top-1.5 h-3 rounded flex items-center px-1.5 gap-1"
                          style={{
                            backgroundColor: preset.elevatedBg,
                            opacity: 0.9,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: preset.accentColor }}
                          />
                          <span
                            className="w-6 h-1 rounded-full opacity-45"
                            style={{ backgroundColor: preset.textPrimary }}
                          />
                        </div>
                        <div className="absolute bottom-2 right-2.5 flex items-end gap-1">
                          <span className="w-1.5 h-4 rounded-[1px]" style={{ backgroundColor: preset.bullColor }} />
                          <span className="w-1.5 h-3 rounded-[1px]" style={{ backgroundColor: preset.bearColor }} />
                          <span className="w-1.5 h-6 rounded-[1px]" style={{ backgroundColor: preset.bullColor }} />
                          <span className="w-1.5 h-2.5 rounded-[1px]" style={{ backgroundColor: preset.bearColor }} />
                        </div>
                        {isActive && (
                          <span
                            className="absolute bottom-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: preset.accentColor,
                              color: getContrastText(preset.accentColor),
                            }}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-semibold truncate">{preset.name}</span>
                        <span
                          className="text-[9.5px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0"
                          style={{
                            borderColor: preset.borderColor,
                            color: preset.textSecondary,
                          }}
                        >
                          {preset.isLight ? 'Light' : 'Dark'}
                        </span>
                      </div>
                      <div
                        className="text-[10.5px] mt-1 flex items-center justify-between"
                        style={{ color: preset.textMuted }}
                      >
                        <span className="capitalize">{preset.wallpaperMode.replace('-', ' ')}</span>
                        <div className="flex items-center gap-1">
                          {[preset.accentColor, preset.bullColor, preset.bearColor].map((c, idx) => (
                            <span
                              key={idx}
                              className="w-2.5 h-2.5 rounded-full border border-black/20"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3.5 rounded-xl tv-glass-card border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--tv-text)]">
                    Want deeper frosted glass or custom brand accents?
                  </div>
                  <div className="text-[11px] text-[var(--tv-text-muted)]">
                    Fine-tune live wallpaper motion, backdrop blur, glass opacity, and chart candle colors.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('wallpaper')}
                    className="px-3 py-1.5 rounded-lg border border-[var(--tv-border-glass)] bg-[var(--tv-bg-hover)] hover:opacity-90 text-[11.5px] font-medium"
                  >
                    Live Wallpaper
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('glass_custom')}
                    className="px-3 py-1.5 rounded-lg text-[11.5px] font-semibold"
                    style={{
                      backgroundColor: 'var(--tv-accent)',
                      color: 'var(--tv-accent-contrast)',
                    }}
                  >
                    Customize Colors
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'wallpaper' && (
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)] mb-2.5">
                  Animated Background Mode
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {WALLPAPER_MODES.map((m) => {
                    const active = theme.wallpaperMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => updateCustom({ wallpaperMode: m.id }, false)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-[var(--tv-accent)] ring-1 ring-[var(--tv-accent)]'
                            : 'tv-glass-card border hover:border-[var(--tv-accent-border)]'
                        }`}
                        style={
                          active
                            ? { backgroundColor: 'var(--tv-accent-soft)' }
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--tv-text)]">
                          <span>{m.label}</span>
                          {active && <Check className="w-3.5 h-3.5 text-[var(--tv-accent)]" />}
                        </div>
                        <div className="text-[10.5px] text-[var(--tv-text-muted)] mt-1">
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--tv-text)]">Wallpaper Glow Intensity</span>
                    <span className="font-mono tabular-nums text-[var(--tv-accent)] font-semibold">
                      {Math.round(theme.wallpaperOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.01}
                    value={theme.wallpaperOpacity}
                    onChange={(e) =>
                      updateCustom({ wallpaperOpacity: parseFloat(e.target.value) }, false)
                    }
                    aria-label="Wallpaper Glow Intensity"
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--tv-text)]">Animation Speed</span>
                    <span className="font-mono tabular-nums text-[var(--tv-accent)] font-semibold">
                      {theme.wallpaperSpeed.toFixed(2)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    value={theme.wallpaperSpeed}
                    onChange={(e) =>
                      updateCustom({ wallpaperSpeed: parseFloat(e.target.value) }, false)
                    }
                    aria-label="Wallpaper Animation Speed"
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)] mb-2.5">
                  Wallpaper Ambient Palette
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <ColorField
                    label="Primary Glow"
                    value={theme.wallpaperColors[0]}
                    onChange={(c) =>
                      updateCustom(
                        { wallpaperColors: [c, theme.wallpaperColors[1], theme.wallpaperColors[2]] },
                        false
                      )
                    }
                  />
                  <ColorField
                    label="Secondary Glow"
                    value={theme.wallpaperColors[1]}
                    onChange={(c) =>
                      updateCustom(
                        { wallpaperColors: [theme.wallpaperColors[0], c, theme.wallpaperColors[2]] },
                        false
                      )
                    }
                  />
                  <ColorField
                    label="Highlight Glow"
                    value={theme.wallpaperColors[2]}
                    onChange={(c) =>
                      updateCustom(
                        { wallpaperColors: [theme.wallpaperColors[0], theme.wallpaperColors[1], c] },
                        false
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'glass_custom' && (
            <div className="space-y-5">
              {/* Base Polarity + Glass Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--tv-text)]">Panel Glass Opacity</span>
                    <span className="font-mono tabular-nums text-[var(--tv-accent)] font-semibold">
                      {Math.round(theme.glassOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.35}
                    max={0.96}
                    step={0.01}
                    value={theme.glassOpacity}
                    onChange={(e) =>
                      updateCustom({ glassOpacity: parseFloat(e.target.value) }, false)
                    }
                    aria-label="Panel Glass Opacity"
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--tv-text)]">Frosted Blur Radius</span>
                    <span className="font-mono tabular-nums text-[var(--tv-accent)] font-semibold">
                      {theme.glassBlurPx}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={32}
                    step={1}
                    value={theme.glassBlurPx}
                    onChange={(e) =>
                      updateCustom({ glassBlurPx: parseInt(e.target.value, 10) }, false)
                    }
                    aria-label="Frosted Blur Radius"
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl tv-glass-card border space-y-2">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-medium text-[var(--tv-text)]">Chart Pane Opacity</span>
                    <span className="font-mono tabular-nums text-[var(--tv-accent)] font-semibold">
                      {Math.round(theme.chartBgOpacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.55}
                    max={1}
                    step={0.01}
                    value={theme.chartBgOpacity}
                    onChange={(e) =>
                      updateCustom({ chartBgOpacity: parseFloat(e.target.value) }, false)
                    }
                    aria-label="Chart Pane Opacity"
                    className="w-full accent-[var(--tv-accent)] cursor-pointer"
                  />
                </div>
              </div>

              {/* Base Theme Polarity Switch */}
              <div className="p-3 rounded-xl tv-glass-card border flex items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-semibold text-[var(--tv-text)]">
                    Contrast Mode Polarity
                  </div>
                  <div className="text-[10.5px] text-[var(--tv-text-muted)]">
                    Automatically adapts text, hover tints, and scale legibility
                  </div>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg border border-[var(--tv-border-glass)] bg-[var(--tv-bg-input)]">
                  <button
                    type="button"
                    onClick={() => togglePolarity(false)}
                    className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium flex items-center gap-1.5 transition-colors ${
                      !theme.isLight
                        ? 'font-semibold'
                        : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                    }`}
                    style={
                      !theme.isLight
                        ? {
                            backgroundColor: 'var(--tv-accent)',
                            color: 'var(--tv-accent-contrast)',
                          }
                        : undefined
                    }
                  >
                    <Moon className="w-3.5 h-3.5" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => togglePolarity(true)}
                    className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium flex items-center gap-1.5 transition-colors ${
                      theme.isLight
                        ? 'font-semibold'
                        : 'text-[var(--tv-text-muted)] hover:text-[var(--tv-text)]'
                    }`}
                    style={
                      theme.isLight
                        ? {
                            backgroundColor: 'var(--tv-accent)',
                            color: 'var(--tv-accent-contrast)',
                          }
                        : undefined
                    }
                  >
                    <Sun className="w-3.5 h-3.5" />
                    <span>Light</span>
                  </button>
                </div>
              </div>

              {/* Color Pickers Grid */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--tv-text-muted)] mb-2.5">
                  Surface, Accent &amp; Chart Palette
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  <ColorField
                    label="App Backdrop"
                    value={theme.appBg}
                    onChange={(c) => updateCustom({ appBg: c }, true)}
                  />
                  <ColorField
                    label="Glass Panel Tint"
                    value={theme.panelBg}
                    onChange={(c) => updateCustom({ panelBg: c }, false)}
                  />
                  <ColorField
                    label="Elevated / Popover"
                    value={theme.elevatedBg}
                    onChange={(c) => updateCustom({ elevatedBg: c }, false)}
                  />
                  <ColorField
                    label="Accent Color"
                    value={theme.accentColor}
                    onChange={(c) => updateCustom({ accentColor: c }, false)}
                  />
                  <ColorField
                    label="Primary Text"
                    value={theme.textPrimary}
                    onChange={(c) => updateCustom({ textPrimary: c }, true)}
                  />
                  <ColorField
                    label="Muted Text"
                    value={theme.textMuted}
                    onChange={(c) => updateCustom({ textMuted: c }, true)}
                  />
                  <ColorField
                    label="Chart Background"
                    value={theme.chartBg}
                    onChange={(c) => updateCustom({ chartBg: c }, true)}
                  />
                  <ColorField
                    label="Chart Grid Lines"
                    value={theme.chartGridColor}
                    onChange={(c) => updateCustom({ chartGridColor: c }, true)}
                  />
                  <ColorField
                    label="Border Tint"
                    value={theme.borderColor}
                    onChange={(c) => updateCustom({ borderColor: c }, true)}
                  />
                  <ColorField
                    label="Bullish Candle"
                    value={theme.bullColor}
                    onChange={(c) => updateCustom({ bullColor: c }, true)}
                  />
                  <ColorField
                    label="Bearish Candle"
                    value={theme.bearColor}
                    onChange={(c) => updateCustom({ bearColor: c }, true)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--tv-border-glass)] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => onUpdateTheme({ ...DEFAULT_APP_THEME }, true)}
            className="px-3 py-1.5 rounded-lg border border-[var(--tv-border-glass)] bg-[var(--tv-bg-hover)] hover:opacity-90 text-[12px] font-medium text-[var(--tv-text-secondary)] flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Obsidian Glass</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--tv-accent)',
              color: 'var(--tv-accent-contrast)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
