// Five keyframe tile shapes described as four annulus parameters each.
// All shapes are annuli (ring with optional inner hole). A "filled disk"
// is just an annulus with innerR=0 — so morphing radius and innerR
// continuously transitions disk ↔ ring. Values normalized to a 120-unit
// viewBox; render code rescales by tile size.

import type { TileParams } from './types';
import { lerp } from './noise';

/** Heaviest → lightest. UI's "Number of symbols" slider takes a prefix of this array. */
export const TILE_PARAMS: readonly TileParams[] = [
  { outerR: 59.85, outerInnerR:  0,    midR:  0,    midInnerR:  0    }, // 0 disk
  { outerR: 59.87, outerInnerR: 51.87, midR: 14.97, midInnerR:  0    }, // 1 ring + dot
  { outerR: 59.87, outerInnerR: 51.87, midR: 34.93, midInnerR: 26.93 }, // 2 two rings
  { outerR: 59.87, outerInnerR: 51.87, midR:  0,    midInnerR:  0    }, // 3 ring
  { outerR: 16,    outerInnerR:  0,    midR:  0,    midInnerR:  0    }, // 4 small dot
] as const;

/** Synthetic "blank" keyframe appended at the lightest end so cells can fade to nothing. */
export const BLANK_PARAMS: TileParams = {
  outerR: 0,
  outerInnerR: 0,
  midR: 0,
  midInnerR: 0,
};

export function lerpTileParams(a: TileParams, b: TileParams, t: number): TileParams {
  return {
    outerR:      lerp(a.outerR,      b.outerR,      t),
    outerInnerR: lerp(a.outerInnerR, b.outerInnerR, t),
    midR:        lerp(a.midR,        b.midR,        t),
    midInnerR:   lerp(a.midInnerR,   b.midInnerR,   t),
  };
}

/** Draw an annulus (ring with optional inner hole) at (cx, cy). innerR=0 → solid disk. */
export function drawAnnulus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  color: string,
): void {
  if (outerR <= 0.1) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  if (innerR > 0.1 && innerR < outerR) {
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true); // ccw → hole via even-odd
  }
  ctx.fill('evenodd');
}

/** Draw a tile at (cx, cy) of overall pixel size `size`, using params normalized to viewBox=120. */
export function drawMorphedTile(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  params: TileParams,
  color: string,
): void {
  const s = size / 120;
  drawAnnulus(ctx, cx, cy, params.outerR * s, params.outerInnerR * s, color);
  drawAnnulus(ctx, cx, cy, params.midR   * s, params.midInnerR   * s, color);
}
