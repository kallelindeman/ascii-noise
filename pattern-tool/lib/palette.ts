// Fixed 10-color brand palette. Indices stable — keep in sync with PALETTE
// references in components and PAIRS.

export interface PaletteColor {
  name: string;
  hex: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { name: 'Graphite',  hex: '#141414' },  // 0
  { name: 'Bone',      hex: '#F4F4ED' },  // 1
  { name: 'Pistachio', hex: '#E9ECCD' },  // 2
  { name: 'Sky',       hex: '#C6EBFE' },  // 3
  { name: 'Lime',      hex: '#C7C86E' },  // 4
  { name: 'Ice',       hex: '#6AC6F5' },  // 5
  { name: 'Olive',     hex: '#9E9763' },  // 6
  { name: 'Moss',      hex: '#3E360E' },  // 7
  { name: 'Earth',     hex: '#452412' },  // 8
  { name: 'Clay',      hex: '#9D7B51' },  // 9
] as const;

export const PALETTE_BY_NAME = Object.fromEntries(
  PALETTE.map((c) => [c.name, c]),
) as Record<string, PaletteColor>;

export interface PalettePair {
  name: string;
  fgIdx: number;
  bgIdx: number;
}

/** Curated starter pairs (foreground, background). */
export const PAIRS: readonly PalettePair[] = [
  { name: 'Earth / Sky',      fgIdx: 8, bgIdx: 3 },
  { name: 'Graphite / Bone',  fgIdx: 0, bgIdx: 1 },
  { name: 'Moss / Pistachio', fgIdx: 7, bgIdx: 2 },
  { name: 'Clay / Ice',       fgIdx: 9, bgIdx: 5 },
] as const;
