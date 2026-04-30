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

export function fbm3(
  x: number,
  y: number,
  z: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise3(x * freq, y * freq, z * freq, seed) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return v / max;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
