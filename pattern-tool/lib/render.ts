// The full render pipeline. Pure function: given a canvas, settings, and
// optional image data, paints the morphed-tile pattern with optional gradient
// mask. No React, no DOM listeners — this is what the canvas component
// schedules from a useEffect.
//
// Flow:
//   1. Compute target canvas size from aspect.
//   2. Compute per-cell brightness (noise OR image, never both — sources are
//      exclusive).
//   3. Histogram-equalize ranks → continuous tile index in [0, N].
//   4. Resize canvas to physical pixels (supersampled), set transform.
//   5. Paint background (or clear when transparent).
//   6. Per cell: optionally apply gradient mask (skip or fade), then draw
//      the morphed annulus.

import type { ImageData as PatternImageData, Settings } from './types';
import { lerp, warpedFbm3 } from './noise';
import { TILE_PARAMS, BLANK_PARAMS, lerpTileParams, drawMorphedTile } from './tiles';
import { sampleImage } from './image';
import { PAIRS, PALETTE } from './palette';

// Hardcoded internals — not user-exposed. Same values as the prototype.
const LACUNARITY      = 2.0;
const DEFAULT_RENDERSCALE     = 2;
const DEFAULT_LONG_EDGE = 2048;
const SPACING_RATIO   = 0.15;
const DEFAULT_ASPECT  = 16 / 9;
const GAIN            = 0.5;

// Reusable typed buffers. Module-scoped so successive renders skip allocation
// when the grid size is unchanged.
let valsBuf = new Float32Array(0);

function aspectOf(settings: Settings): number {
  if (settings.aspect === 'custom') {
    const w = Math.max(1, settings.aspectW | 0);
    const h = Math.max(1, settings.aspectH | 0);
    return w / h;
  }
  if (/^\d+:\d+$/.test(settings.aspect)) {
    const [w, h] = settings.aspect.split(':').map((n) => parseFloat(n));
    if (w > 0 && h > 0) return w / h;
  }
  return DEFAULT_ASPECT;
}

export function computeCanvasSize(settings: Settings): { CW: number; CH: number } {
  return computeCanvasSizeWithLongEdge(settings, DEFAULT_LONG_EDGE);
}

export function computeCanvasSizeWithLongEdge(
  settings: Settings,
  longEdge: number,
): { CW: number; CH: number } {
  const a = aspectOf(settings);
  const L = Math.max(16, Math.round(longEdge));
  if (a >= 1) return { CW: L, CH: Math.max(1, Math.round(L / a)) };
  return { CW: Math.max(1, Math.round(L * a)), CH: L };
}

function resolveCanvasSize(
  settings: Settings,
  sizeOverride?: { CW: number; CH: number },
  longEdgeOverride?: number,
): { CW: number; CH: number } {
  if (sizeOverride) {
    return { CW: Math.max(1, Math.round(sizeOverride.CW)), CH: Math.max(1, Math.round(sizeOverride.CH)) };
  }
  if (typeof longEdgeOverride === 'number') {
    return computeCanvasSizeWithLongEdge(settings, longEdgeOverride);
  }
  return computeCanvasSizeWithLongEdge(settings, DEFAULT_LONG_EDGE);
}

export interface RenderInput {
  canvas: HTMLCanvasElement;
  settings: Settings;
  image: PatternImageData | null;
  zTime: number;
  /** Override logical canvas size (pre-supersample). */
  sizeOverride?: { CW: number; CH: number };
  /** Override the default logical long edge when deriving CW/CH from aspect. */
  longEdgeOverride?: number;
  /** Override the default supersample factor. */
  renderScaleOverride?: number;
}

export function render({
  canvas,
  settings,
  image,
  zTime,
  sizeOverride,
  longEdgeOverride,
  renderScaleOverride,
}: RenderInput): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { CW, CH } = resolveCanvasSize(settings, sizeOverride, longEdgeOverride);
  const renderScale = Math.max(1, Math.round(renderScaleOverride ?? DEFAULT_RENDERSCALE));

  const cellsize = Math.round(lerp(80, 8, settings.scale01));
  const noiseScl = lerp(1, 12, settings.gridsize01);
  const octaves  = Math.max(1, settings.octaves | 0);
  const pair = PAIRS[settings.pairIdx] ?? PAIRS[0];
  const fgColor  = PALETTE[pair.fgIdx].hex;
  const bgColor  = PALETTE[pair.bgIdx].hex;
  const seed     = settings.seed | 0;

  const effectiveFg = settings.invert ? bgColor : fgColor;
  const effectiveBg = settings.invert ? fgColor : bgColor;

  // Active tile palette: heaviest-first prefix + a synthetic blank at the end
  // so empty cells have a stable representation in the morph.
  const activeTiles = TILE_PARAMS.slice(0, settings.symbols).concat([BLANK_PARAMS]);
  const N = activeTiles.length - 1;

  const cols   = Math.max(1, Math.round(CW / cellsize));
  const rows   = Math.max(1, Math.round(CH / cellsize));
  const cellW  = CW / cols;
  const cellH  = CH / rows;
  const tileSize = Math.max(2, Math.min(cellW, cellH) - cellsize * SPACING_RATIO);
  const total  = cols * rows;

  if (valsBuf.length < total) {
    valsBuf = new Float32Array(total);
  }

  const sc = 1 / noiseScl;

  // 1. Per-cell brightness — sources are exclusive
  const useImage     = settings.source === 'media' && image !== null;
  const targetAspect = CW / CH;
  const clipLo  = settings.clipLow;
  const clipHi  = settings.clipHigh;
  const clipRng = Math.max(0.0001, clipHi - clipLo);

  // Noise configuration (internal). We keep these hardcoded for now; optional UI
  // controls will override later.
  const noiseType = settings.noiseType ?? 'simplex';
  const warp01 = settings.warp01 ?? 0.65;
  const warpAmp = lerp(0.0, 1.25, Math.max(0, Math.min(1, warp01)));
  const warpFreq = lerp(0.6, 2.2, Math.max(0, Math.min(1, warp01)));
  const noiseZ = zTime;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let v: number;
      if (useImage) {
        const lum = sampleImage(image!, c / cols, r / rows, targetAspect);
        v = (lum - clipLo) / clipRng;
        if (v < 0) v = 0; else if (v > 1) v = 1;
      } else {
        // Noise is sampled in normalized canvas space so symbol size (cellsize)
        // doesn't change the apparent noise feature scale.
        const nx = c / cols;
        const ny = r / rows;
        v = warpedFbm3(
          nx * noiseScl,
          ny * noiseScl * 0.55,
          noiseZ,
          seed,
          octaves,
          LACUNARITY,
          GAIN,
          { amp: warpAmp, freq: warpFreq, type: noiseType },
          noiseType,
        );
      }
      valsBuf[i] = v;
    }
  }

  // 2. Monotonic mapping → continuous tile index in [0, N]
  // We *stretch* the observed range per-frame (min/max normalization) so the
  // full symbol set is exercised, without the nonlocal rank swapping that comes
  // from histogram sorting.
  const tileMap = new Float32Array(total);
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < total; i++) {
    const v = valsBuf[i];
    if (v < vMin) vMin = v;
    if (v > vMax) vMax = v;
  }
  const vRange = Math.max(1e-6, vMax - vMin);
  const gamma = 0.85; // <1 boosts mids a bit; tweakable later
  for (let i = 0; i < total; i++) {
    const v01 = (valsBuf[i] - vMin) / vRange;
    const curved = Math.pow(Math.max(0, Math.min(1, v01)), gamma);
    tileMap[i] = curved * N;
  }

  // 3. Resize canvas (supersampled) and set transform
  const physW = CW * renderScale;
  const physH = CH * renderScale;
  if (canvas.width !== physW || canvas.height !== physH) {
    canvas.width  = physW;
    canvas.height = physH;
  }
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  // 4. Background
  if (settings.transparent) {
    ctx.clearRect(0, 0, CW, CH);
  } else {
    ctx.fillStyle = effectiveBg;
    ctx.fillRect(0, 0, CW, CH);
  }

  // 5. Gradient mask precompute
  const gradOn = settings.gradient;
  let gradDx = 0, gradDy = 0, gradPos = 0.5, gradFade = 0, gradEdge = 0;
  let projMin = 0, projRange = 1, jitterFreq = 8;
  if (gradOn) {
    const ang = settings.gradientAngle * Math.PI / 180;
    gradDx = Math.cos(ang);
    gradDy = Math.sin(ang);
    gradPos  = settings.gradientPos  / 100;
    gradFade = settings.gradientFade / 100;
    gradEdge = settings.gradientEdge / 100;
    jitterFreq = lerp(2, 30, settings.gradientEdgeScale / 100);
    const projs = [0, gradDx, gradDy, gradDx + gradDy];
    projMin = Math.min(...projs);
    projRange = Math.max(...projs) - projMin || 1;
  }

  // 6. Draw morphed tiles (with optional gradient mask + soft fade)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;

      let fadeAmt = 1;
      if (gradOn) {
        const nx = (c + 0.5) / cols;
        const ny = (r + 0.5) / rows;
        const proj  = (nx * gradDx + ny * gradDy - projMin) / projRange;
        // Edge jitter should be subtle and temporally smooth; use lower warp.
        const j     = warpedFbm3(
          nx * jitterFreq,
          ny * jitterFreq,
          zTime * 0.06 + 100,
          seed + 31,
          2,
          LACUNARITY,
          0.55,
          { amp: warpAmp * 0.25, freq: warpFreq * 0.9, type: noiseType },
          noiseType,
        );
        const projJ = proj + (j - 0.5) * gradEdge;
        const dist  = projJ - gradPos;
        if (dist < 0) continue;
        if (gradFade > 0.001 && dist < gradFade) {
          const t = dist / gradFade;
          fadeAmt = t * t * (3 - 2 * t);
        }
        if (fadeAmt < 0.05) continue;
      }

      const f    = tileMap[i];
      const lo   = Math.min(Math.floor(f), N);
      const hi   = Math.min(lo + 1, N);
      const frac = f - lo;
      const params =
        lo === hi ? activeTiles[lo] : lerpTileParams(activeTiles[lo], activeTiles[hi], frac);
      if (params.outerR <= 0.1 && params.midR <= 0.1) continue;

      drawMorphedTile(
        ctx,
        (c + 0.5) * cellW,
        (r + 0.5) * cellH,
        tileSize * fadeAmt,
        params,
        effectiveFg,
      );
    }
  }
}
