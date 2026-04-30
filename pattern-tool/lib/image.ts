// Image input pipeline: decode a File into a luminance buffer, plus the
// cover-fit sampler used by the render pipeline.
//
// Decoding happens once on upload via an offscreen canvas. The luminance
// buffer is row-major, 0..1, sized to the image's natural dimensions
// (not the canvas) — sampling reads any cell on demand.

import type { ImageData as PatternImageData } from './types';

/** Decode a File into a luminance buffer. Resolves with row-major Float32Array (0..1). */
export async function decodeImageFile(file: File): Promise<PatternImageData> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d', { willReadFrequently: true });
    if (!offCtx) throw new Error('Failed to acquire 2D context for image decode');
    offCtx.drawImage(img, 0, 0);

    const raw = offCtx.getImageData(0, 0, w, h).data;
    const pixels = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const r = raw[i * 4];
      const g = raw[i * 4 + 1];
      const b = raw[i * 4 + 2];
      pixels[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    return { pixels, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image decode failed'));
    img.src = src;
  });
}

/**
 * Cover-fit sampler. The image fills the canvas in both dimensions, preserving
 * aspect ratio; the overflowing dimension is center-cropped equally. Always
 * returns a valid in-image luminance value (no letterbox holes).
 *
 * `canvasAspect` MUST be the target render aspect (CW / CH), not the lagging
 * canvas.width/canvas.height — otherwise the first frame after an aspect change
 * uses the previous aspect for sampling.
 */
export function sampleImage(
  data: PatternImageData,
  normX: number,
  normY: number,
  canvasAspect: number,
): number {
  const imgAspect = data.width / data.height;
  let sx: number, sy: number;

  if (imgAspect > canvasAspect) {
    // Image wider than canvas — height fills, crop horizontally
    const k = canvasAspect / imgAspect;
    sx = normX * k + (1 - k) * 0.5;
    sy = normY;
  } else {
    // Image taller than canvas — width fills, crop vertically
    const k = imgAspect / canvasAspect;
    sy = normY * k + (1 - k) * 0.5;
    sx = normX;
  }

  // Clamp for floating-point safety; under cover, sx/sy are always inside [0,1]
  if (sx < 0) sx = 0; else if (sx > 1) sx = 1;
  if (sy < 0) sy = 0; else if (sy > 1) sy = 1;

  const px = Math.min(Math.floor(sx * data.width),  data.width  - 1);
  const py = Math.min(Math.floor(sy * data.height), data.height - 1);
  return data.pixels[py * data.width + px];
}
