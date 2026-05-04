// 3D value noise + fractal Brownian motion. Z dimension carries time so the
// pattern evolves smoothly as `zTime` advances — used for the optional
// animation loop and for gradient-edge jitter.
//
// Ported verbatim from the prototype's pattern.html.

function hash3(x: number, y: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453123;
  return n - Math.floor(n);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = smoothstep(fx), uy = smoothstep(fy), uz = smoothstep(fz);

  const n000 = hash3(ix,   iy,   iz,   seed);
  const n100 = hash3(ix+1, iy,   iz,   seed);
  const n010 = hash3(ix,   iy+1, iz,   seed);
  const n110 = hash3(ix+1, iy+1, iz,   seed);
  const n001 = hash3(ix,   iy,   iz+1, seed);
  const n101 = hash3(ix+1, iy,   iz+1, seed);
  const n011 = hash3(ix,   iy+1, iz+1, seed);
  const n111 = hash3(ix+1, iy+1, iz+1, seed);

  const x00 = n000 + (n100 - n000) * ux;
  const x10 = n010 + (n110 - n010) * ux;
  const x01 = n001 + (n101 - n001) * ux;
  const x11 = n011 + (n111 - n011) * ux;

  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

// -----------------------------------------------------------------------------
// Seeded 3D simplex noise (more organic than value noise)
// -----------------------------------------------------------------------------

export type NoiseType = 'simplex' | 'value';

type PermTable = { perm: Uint8Array; permMod12: Uint8Array };
const permCache = new Map<number, PermTable>();

function xmur3(str: string): () => number {
  // Small string hash → deterministic 32-bit seeds.
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getPerm(seed: number): PermTable {
  const s = seed | 0;
  const cached = permCache.get(s);
  if (cached) return cached;

  // Deterministic shuffle of 0..255 based on the seed.
  const seedFn = xmur3(`simplex:${s}`)();
  const rnd = mulberry32(seedFn);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  // Duplicate to avoid wrap checks; store mod 12 for grad lookup.
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    const v = p[i & 255];
    perm[i] = v;
    permMod12[i] = v % 12;
  }

  const table = { perm, permMod12 };
  permCache.set(s, table);
  return table;
}

// 12 gradients for 3D simplex
const GRAD3: ReadonlyArray<[number, number, number]> = [
  [ 1,  1,  0], [-1,  1,  0], [ 1, -1,  0], [-1, -1,  0],
  [ 1,  0,  1], [-1,  0,  1], [ 1,  0, -1], [-1,  0, -1],
  [ 0,  1,  1], [ 0, -1,  1], [ 0,  1, -1], [ 0, -1, -1],
];

function dot3(g: readonly [number, number, number], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * Seeded 3D simplex noise in [-1, 1].
 * Based on Stefan Gustavson's reference implementation, adapted for TS.
 */
export function simplex3(x: number, y: number, z: number, seed: number): number {
  const { perm, permMod12 } = getPerm(seed);

  // Skew/unskew factors for 3D
  const F3 = 1 / 3;
  const G3 = 1 / 6;

  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;

  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  // Simplex corner ordering
  let i1 = 0, j1 = 0, k1 = 0;
  let i2 = 0, j2 = 0, k2 = 0;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } // X Y Z
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; } // X Z Y
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; } // Z X Y
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; } // Z Y X
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; } // Y Z X
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; } // Y X Z
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3;
  const y2 = y0 - j2 + 2 * G3;
  const z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3;
  const y3 = y0 - 1 + 3 * G3;
  const z3 = z0 - 1 + 3 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  const gi0 = permMod12[ii + perm[jj + perm[kk]]];
  const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
  const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
  const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 > 0) {
    t0 *= t0;
    n0 = t0 * t0 * dot3(GRAD3[gi0], x0, y0, z0);
  }
  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 > 0) {
    t1 *= t1;
    n1 = t1 * t1 * dot3(GRAD3[gi1], x1, y1, z1);
  }
  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 > 0) {
    t2 *= t2;
    n2 = t2 * t2 * dot3(GRAD3[gi2], x2, y2, z2);
  }
  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 > 0) {
    t3 *= t3;
    n3 = t3 * t3 * dot3(GRAD3[gi3], x3, y3, z3);
  }

  // Scale to roughly [-1, 1]
  return 32 * (n0 + n1 + n2 + n3);
}

/** Unified noise API. Returns in [-1, 1]. */
export function noise3(x: number, y: number, z: number, seed: number, type: NoiseType = 'simplex'): number {
  if (type === 'value') return valueNoise3(x, y, z, seed) * 2 - 1;
  return simplex3(x, y, z, seed);
}

export function fbm3(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  type: NoiseType = 'simplex',
): number {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    // Normalize each octave to [0,1] to keep downstream mapping stable.
    const n = noise3(x * freq, y * freq, z * freq, seed, type);
    v += ((n + 1) * 0.5) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return v / max;
}

export interface DomainWarpOptions {
  /** Strength of warp in input coordinate units. Typical range: 0..1.5 */
  amp: number;
  /** Frequency multiplier for the warp field. */
  freq: number;
  /** Noise type used to generate warp. */
  type?: NoiseType;
}

/**
 * Domain-warped fBm: uses a low-octave vector field to warp the sample domain,
 * producing more organic, turbulent shapes.
 *
 * Returns in [0,1].
 */
export function warpedFbm3(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  gain: number,
  warp: DomainWarpOptions,
  type: NoiseType = 'simplex',
): number {
  const wType = warp.type ?? type;
  const wf = Math.max(0.0001, warp.freq);
  const wa = warp.amp;
  if (wa <= 0) return fbm3(x, y, z, seed, octaves, lacunarity, gain, type);

  // Two-channel warp (XY) + a small Z warp for richer motion.
  const wx = fbm3(x * wf + 19.1, y * wf - 7.3, z * wf + 3.7, seed + 101, 3, lacunarity, 0.55, wType);
  const wy = fbm3(x * wf - 11.7, y * wf + 23.4, z * wf + 9.9, seed + 211, 3, lacunarity, 0.55, wType);
  const wz = fbm3(x * wf + 5.2, y * wf + 1.8, z * wf - 14.6, seed + 307, 2, lacunarity, 0.6, wType);

  const dx = (wx - 0.5) * 2 * wa;
  const dy = (wy - 0.5) * 2 * wa;
  const dz = (wz - 0.5) * 2 * wa * 0.5;

  return fbm3(x + dx, y + dy, z + dz, seed, octaves, lacunarity, gain, type);
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
