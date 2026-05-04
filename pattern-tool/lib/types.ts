// Shared types for the pattern generator.

export type Source = 'pattern' | 'media';

export type AspectPreset = '16:9' | '1:1' | '9:16' | '4:5' | '3:2' | 'custom';

export type NoiseType = 'simplex' | 'value';

/** Single source-of-truth for the canvas. Mirrors the prototype's state shape. */
export interface Settings {
  source: Source;

  // Grid
  scale01: number;          // 0..1 → cell size (smaller value → bigger cells)
  symbols: number;          // 1..5 → number of active morph keyframes
  gridsize01: number;       // 0..1 → noise feature scale (larger value → bigger features)

  // Colors
  pairIdx: number;          // index into PAIRS
  invert: boolean;
  transparent: boolean;

  // Pattern noise
  seed: number;             // 0..999
  octaves: number;          // 1..8
  speed: number;            // 0..3 — animation rate; 0 = static
  noiseType: NoiseType;     // simplex (default) or value (legacy)
  warp01: number;           // 0..1 — domain warp strength

  // Aspect ratio
  aspect: AspectPreset;
  aspectW: number;          // 1..100 (custom only)
  aspectH: number;          // 1..100 (custom only)

  // Image source
  clipLow: number;          // 0..1 — image luminance black point
  clipHigh: number;         // 0..1 — image luminance white point

  // Gradient mask (universal post-process)
  gradient: boolean;
  gradientAngle: number;    // 0..360 deg
  gradientPos: number;      // 0..100 — threshold along gradient axis
  gradientFade: number;     // 0..100 — width of soft falloff zone
  gradientEdge: number;     // 0..100 — strength of noise displacement on the edge
  gradientEdgeScale: number;// 0..100 — frequency of edge jitter (smaller = bigger teeth)
}

export interface ImageData {
  pixels: Float32Array;     // luminance 0..1, row-major width × height
  width: number;
  height: number;
}

export interface TileParams {
  outerR: number;
  outerInnerR: number;
  midR: number;
  midInnerR: number;
}

/** Default settings. Mirrors the prototype's initial values. */
export const DEFAULT_SETTINGS: Settings = {
  source: 'pattern',
  scale01: 0.50,
  symbols: 5,
  gridsize01: 0.40,
  pairIdx: 0,               // Earth / Sky
  invert: false,
  transparent: false,
  seed: 1,
  octaves: 4,
  speed: 0.0,
  noiseType: 'simplex',
  warp01: 0.65,
  aspect: '16:9',
  aspectW: 16,
  aspectH: 9,
  clipLow: 0.0,
  clipHigh: 1.0,
  gradient: false,
  gradientAngle: 0,
  gradientPos: 50,
  gradientFade: 0,
  gradientEdge: 30,
  gradientEdgeScale: 40,
};
