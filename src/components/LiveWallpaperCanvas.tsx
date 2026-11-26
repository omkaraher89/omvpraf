import React, { useEffect, useRef } from 'react';
import { AppThemeConfig } from '../types/trading';
import { hexToRgba } from '../utils/themeEngine';

interface LiveWallpaperCanvasProps {
  theme: AppThemeConfig;
}

interface NodeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  colorIdx: number;
  phase: number;
}

export const LiveWallpaperCanvas: React.FC<LiveWallpaperCanvasProps> = ({ theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (theme.wallpaperMode === 'none') return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const particles: NodeParticle[] = Array.from({ length: 42 }, (_, idx) => ({
      x: ((idx * 193) % 1000) / 1000,
      y: ((idx * 389 + 117) % 1000) / 1000,
      vx: (((idx % 7) - 3) * 0.00018) || 0.00014,
      vy: ((((idx + 2) % 5) - 2) * 0.00016) || -0.00012,
      r: 1.4 + (idx % 4) * 0.6,
      colorIdx: idx % 3,
      phase: idx * 0.7,
    }));

    const stars = Array.from({ length: 95 }, (_, idx) => ({
      x: ((idx * 269 + 41) % 1000) / 1000,
      y: ((idx * 491 + 83) % 1000) / 1000,
      depth: 0.35 + ((idx * 17) % 100) / 110,
      size: 0.7 + (idx % 3) * 0.55,
      colorIdx: idx % 3,
      twinklePhase: idx * 0.93,
    }));

    let rafId = 0;
    let startTime = performance.now();
    let hiddenAt: number | null = null;

    const drawFrame = (now: number) => {
      const elapsedSec = ((now - startTime) / 1000) * Math.max(0.15, theme.wallpaperSpeed);
      const intensity = Math.max(0.05, Math.min(1, theme.wallpaperOpacity));
      const colors = theme.wallpaperColors;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = theme.appBg;
      ctx.fillRect(0, 0, width, height);

      if (theme.wallpaperMode === 'aurora') {
        const blobs = [
          {
            cx: width * (0.25 + 0.16 * Math.sin(elapsedSec * 0.28)),
            cy: height * (0.28 + 0.14 * Math.cos(elapsedSec * 0.22)),
            rad: Math.max(width, height) * 0.48,
            color: colors[0],
            alpha: 0.44 * intensity,
          },
          {
            cx: width * (0.74 + 0.15 * Math.cos(elapsedSec * 0.24)),
            cy: height * (0.35 + 0.16 * Math.sin(elapsedSec * 0.31)),
            rad: Math.max(width, height) * 0.44,
            color: colors[1],
            alpha: 0.36 * intensity,
          },
          {
            cx: width * (0.5 + 0.2 * Math.sin(elapsedSec * 0.19 + 1.4)),
            cy: height * (0.76 + 0.12 * Math.cos(elapsedSec * 0.25)),
            rad: Math.max(width, height) * 0.52,
            color: colors[2],
            alpha: 0.34 * intensity,
          },
        ];

        ctx.save();
        ctx.globalCompositeOperation = theme.isLight ? 'source-over' : 'screen';
        for (const b of blobs) {
          const grad = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, b.rad);
          grad.addColorStop(0, hexToRgba(b.color, b.alpha));
          grad.addColorStop(0.5, hexToRgba(b.color, b.alpha * 0.38));
          grad.addColorStop(1, hexToRgba(b.color, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(b.cx, b.cy, b.rad, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (theme.wallpaperMode === 'constellation') {
        ctx.save();
        const wash = ctx.createRadialGradient(
          width * 0.5,
          height * 0.42,
          0,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.7
        );
        wash.addColorStop(0, hexToRgba(colors[0], 0.16 * intensity));
        wash.addColorStop(0.6, hexToRgba(colors[1], 0.08 * intensity));
        wash.addColorStop(1, 'transparent');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, width, height);

        const speedFactor = reducedMotion ? 0 : 0.25 * theme.wallpaperSpeed;
        const pts = particles.map((p) => {
          const nx = (p.x + p.vx * elapsedSec * 60 * speedFactor + 10) % 1;
          const ny = (p.y + p.vy * elapsedSec * 60 * speedFactor + 10) % 1;
          return {
            px: nx * width,
            py: ny * height,
            r: p.r,
            color: colors[p.colorIdx],
            pulse: 0.65 + 0.35 * Math.sin(elapsedSec * 1.4 + p.phase),
          };
        });

        const linkDist = Math.min(200, Math.max(130, width * 0.13));
        ctx.lineWidth = 1;
        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dx = pts[i].px - pts[j].px;
            const dy = pts[i].py - pts[j].py;
            const d = Math.hypot(dx, dy);
            if (d < linkDist) {
              const alpha = (1 - d / linkDist) * 0.28 * intensity;
              ctx.strokeStyle = hexToRgba(pts[i].color, alpha);
              ctx.beginPath();
              ctx.moveTo(pts[i].px, pts[i].py);
              ctx.lineTo(pts[j].px, pts[j].py);
              ctx.stroke();
            }
          }
        }

        for (const pt of pts) {
          const halo = ctx.createRadialGradient(pt.px, pt.py, 0, pt.px, pt.py, pt.r * 7);
          halo.addColorStop(0, hexToRgba(pt.color, 0.42 * intensity * pt.pulse));
          halo.addColorStop(1, hexToRgba(pt.color, 0));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, pt.r * 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = hexToRgba(pt.color, 0.85 * intensity);
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, pt.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      } else if (theme.wallpaperMode === 'pulse') {
        ctx.save();
        ctx.globalCompositeOperation = theme.isLight ? 'source-over' : 'screen';
        const focalX = width * (0.5 + 0.14 * Math.sin(elapsedSec * 0.22));
        const focalY = height * (0.48 + 0.1 * Math.cos(elapsedSec * 0.18));
        const baseRad = Math.max(width, height) * 0.55;

        const bgGlow = ctx.createRadialGradient(focalX, focalY, 0, focalX, focalY, baseRad);
        bgGlow.addColorStop(0, hexToRgba(colors[0], 0.34 * intensity));
        bgGlow.addColorStop(0.55, hexToRgba(colors[2], 0.16 * intensity));
        bgGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = bgGlow;
        ctx.fillRect(0, 0, width, height);

        const ringCount = 5;
        for (let i = 0; i < ringCount; i++) {
          const progress = ((elapsedSec * 0.16 + i / ringCount) % 1);
          const radius = progress * baseRad * 0.95;
          const ringAlpha = Math.sin(progress * Math.PI) * 0.32 * intensity;
          ctx.strokeStyle = hexToRgba(colors[i % 3], ringAlpha);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(focalX, focalY, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        for (let wIdx = 0; wIdx < 2; wIdx++) {
          ctx.beginPath();
          const yBase = height * (wIdx === 0 ? 0.34 : 0.68);
          for (let x = 0; x <= width; x += 28) {
            const y =
              yBase +
              Math.sin(x * 0.004 + elapsedSec * (0.6 + wIdx * 0.25)) * 42 +
              Math.cos(x * 0.002 - elapsedSec * 0.4) * 24;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = hexToRgba(colors[wIdx + 1], 0.26 * intensity);
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
        ctx.restore();
      } else if (theme.wallpaperMode === 'grid-drift') {
        ctx.save();
        const cell = 56;
        const offsetX = (elapsedSec * 14) % cell;
        const offsetY = (elapsedSec * 10) % cell;

        const g1 = ctx.createRadialGradient(
          width * 0.22,
          height * 0.24,
          0,
          width * 0.22,
          height * 0.24,
          Math.max(width, height) * 0.52
        );
        g1.addColorStop(0, hexToRgba(colors[0], 0.24 * intensity));
        g1.addColorStop(1, 'transparent');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);

        const g2 = ctx.createRadialGradient(
          width * 0.78,
          height * 0.76,
          0,
          width * 0.78,
          height * 0.76,
          Math.max(width, height) * 0.48
        );
        g2.addColorStop(0, hexToRgba(colors[1], 0.2 * intensity));
        g2.addColorStop(1, 'transparent');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = hexToRgba(colors[0], 0.14 * intensity);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = -cell + offsetX; x < width + cell; x += cell) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
        }
        for (let y = -cell + offsetY; y < height + cell; y += cell) {
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
        }
        ctx.stroke();

        for (let xi = 0, x = -cell + offsetX; x < width + cell; x += cell, xi++) {
          for (let yi = 0, y = -cell + offsetY; y < height + cell; y += cell, yi++) {
            if ((xi + yi) % 3 !== 0) continue;
            const pulse = 0.45 + 0.55 * Math.sin(elapsedSec * 1.6 + xi * 0.8 + yi * 0.5);
            ctx.fillStyle = hexToRgba(colors[(xi + yi) % 3], 0.35 * intensity * pulse);
            ctx.beginPath();
            ctx.arc(x, y, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      } else if (theme.wallpaperMode === 'prism-waves') {
        ctx.save();
        ctx.globalCompositeOperation = theme.isLight ? 'source-over' : 'screen';
        const layers = 4;
        for (let l = 0; l < layers; l++) {
          const baseColor = colors[l % 3];
          const yCenter = height * (0.28 + l * 0.18);
          const amp = 36 + l * 14;
          const freq = 0.0026 + l * 0.0007;
          const phase = elapsedSec * (0.38 + l * 0.11) + l * 1.3;

          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width + 32; x += 32) {
            const y =
              yCenter +
              Math.sin(x * freq + phase) * amp +
              Math.cos(x * freq * 0.55 - phase * 0.7) * (amp * 0.45);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(width, height);
          ctx.closePath();

          const grad = ctx.createLinearGradient(0, yCenter - amp, 0, height);
          grad.addColorStop(0, hexToRgba(baseColor, (theme.isLight ? 0.22 : 0.28) * intensity));
          grad.addColorStop(0.55, hexToRgba(baseColor, 0.08 * intensity));
          grad.addColorStop(1, hexToRgba(baseColor, 0));
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.beginPath();
          for (let x = 0; x <= width + 32; x += 32) {
            const y =
              yCenter +
              Math.sin(x * freq + phase) * amp +
              Math.cos(x * freq * 0.55 - phase * 0.7) * (amp * 0.45);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = hexToRgba(baseColor, (theme.isLight ? 0.34 : 0.42) * intensity);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      } else if (theme.wallpaperMode === 'starfield') {
        ctx.save();
        // Subtle nebula bloom behind parallax stars
        const neb1 = ctx.createRadialGradient(
          width * 0.26,
          height * 0.32,
          0,
          width * 0.26,
          height * 0.32,
          Math.max(width, height) * 0.5
        );
        neb1.addColorStop(0, hexToRgba(colors[0], 0.2 * intensity));
        neb1.addColorStop(1, 'transparent');
        ctx.fillStyle = neb1;
        ctx.fillRect(0, 0, width, height);

        const neb2 = ctx.createRadialGradient(
          width * 0.78,
          height * 0.72,
          0,
          width * 0.78,
          height * 0.72,
          Math.max(width, height) * 0.46
        );
        neb2.addColorStop(0, hexToRgba(colors[2], 0.16 * intensity));
        neb2.addColorStop(1, 'transparent');
        ctx.fillStyle = neb2;
        ctx.fillRect(0, 0, width, height);

        const drift = reducedMotion ? 0 : elapsedSec * 0.012;
        for (const s of stars) {
          const sx = ((s.x - drift * s.depth + 10) % 1) * width;
          const sy = ((s.y + drift * 0.22 * s.depth + 10) % 1) * height;
          const twinkle = 0.45 + 0.55 * Math.sin(elapsedSec * 1.9 + s.twinklePhase);
          const alpha = (0.35 + 0.55 * twinkle) * intensity;
          const starColor = s.colorIdx === 0 ? '#ffffff' : colors[s.colorIdx];
          ctx.fillStyle = hexToRgba(starColor, theme.isLight ? alpha * 0.5 : alpha);
          ctx.beginPath();
          ctx.arc(sx, sy, s.size * s.depth, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (!reducedMotion && !document.hidden) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAt = performance.now();
        cancelAnimationFrame(rafId);
      } else if (!reducedMotion) {
        if (hiddenAt !== null) {
          startTime += performance.now() - hiddenAt;
          hiddenAt = null;
        }
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);
    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    theme.wallpaperMode,
    theme.wallpaperOpacity,
    theme.wallpaperSpeed,
    theme.wallpaperColors,
    theme.appBg,
    theme.isLight,
  ]);

  if (theme.wallpaperMode === 'none') {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ backgroundColor: theme.appBg }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="live-wallpaper-canvas"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none"
    />
  );
};
