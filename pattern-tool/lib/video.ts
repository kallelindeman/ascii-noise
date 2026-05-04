import type { ImageData as PatternImageData } from './types';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

export interface LuminanceExtractorOptions {
  /** Downscale for performance; 0/undefined means use source resolution. */
  maxLongEdge?: number;
}

function once(target: EventTarget, type: string): Promise<Event> {
  return new Promise((resolve, reject) => {
    const onEvent = (e: Event) => {
      cleanup();
      resolve(e);
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Video element error while waiting for ${type}`));
    };
    const cleanup = () => {
      target.removeEventListener(type, onEvent);
      target.removeEventListener('error', onError);
    };
    target.addEventListener(type, onEvent, { once: true });
    target.addEventListener('error', onError, { once: true });
  });
}

export function createVideoElement(url: string): HTMLVideoElement {
  const v = document.createElement('video');
  v.src = url;
  v.preload = 'auto';
  v.muted = true;
  v.playsInline = true;
  // Don’t autoplay — user controls preview.
  v.load();
  return v;
}

export async function loadVideoMetadata(video: HTMLVideoElement): Promise<VideoMetadata> {
  if (!Number.isFinite(video.duration) || video.videoWidth === 0 || video.videoHeight === 0) {
    await once(video, 'loadedmetadata');
  }
  return {
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    width: video.videoWidth | 0,
    height: video.videoHeight | 0,
  };
}

export async function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const t = Math.max(0, timeSec);
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    await once(video, 'loadedmetadata');
  }
  const clamped = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(t, Math.max(0, video.duration - 0.001))
    : t;

  // Avoid awaiting seeked when we’re already close — prevents some browsers
  // from stalling when setting the same currentTime repeatedly.
  if (Math.abs((video.currentTime || 0) - clamped) < 0.0005) return;
  video.currentTime = clamped;
  await once(video, 'seeked');
}

export type FrameTick = (nowSec: number) => void;

/**
 * Calls `onFrame` for each decoded video frame while the video is playing.
 * Uses requestVideoFrameCallback when available, otherwise falls back to rAF.
 */
export function startVideoFrameLoop(video: HTMLVideoElement, onFrame: FrameTick): () => void {
  let stopped = false;
  let rafId: number | null = null;
  let vfcHandle: number | null = null;

  const tickRaf = () => {
    if (stopped) return;
    onFrame(video.currentTime || 0);
    rafId = requestAnimationFrame(tickRaf);
  };

  const v = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
    cancelVideoFrameCallback?: (handle: number) => void;
  };

  if (typeof v.requestVideoFrameCallback === 'function') {
    const tickVfc = (_now: number, meta: { mediaTime: number }) => {
      if (stopped) return;
      onFrame(meta.mediaTime);
      vfcHandle = v.requestVideoFrameCallback!(tickVfc);
    };
    vfcHandle = v.requestVideoFrameCallback(tickVfc);
  } else {
    rafId = requestAnimationFrame(tickRaf);
  }

  return () => {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
    if (vfcHandle != null && typeof v.cancelVideoFrameCallback === 'function') v.cancelVideoFrameCallback(vfcHandle);
  };
}

function computeTargetSize(srcW: number, srcH: number, maxLongEdge?: number): { w: number; h: number } {
  const w0 = Math.max(1, srcW | 0);
  const h0 = Math.max(1, srcH | 0);
  if (!maxLongEdge || maxLongEdge <= 0) return { w: w0, h: h0 };
  const long = Math.max(w0, h0);
  if (long <= maxLongEdge) return { w: w0, h: h0 };
  const s = maxLongEdge / long;
  return { w: Math.max(1, Math.round(w0 * s)), h: Math.max(1, Math.round(h0 * s)) };
}

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Failed to acquire 2D context for video decode');
    return { canvas, ctx };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Failed to acquire 2D context for video decode');
  return { canvas, ctx };
}

function rgbaToLuminance(raw: Uint8ClampedArray, out: Float32Array): void {
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const r = raw[i * 4];
    const g = raw[i * 4 + 1];
    const b = raw[i * 4 + 2];
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
}

/**
 * Stateful extractor to avoid per-frame allocations. Draws the CURRENT frame of
 * the provided video element into an internal canvas and returns luminance.
 *
 * The caller controls playback/timing; this function just samples what the
 * video element currently displays.
 */
export function createVideoLuminanceExtractor(
  meta: Pick<VideoMetadata, 'width' | 'height'>,
  opts: LuminanceExtractorOptions = {},
) {
  const { w, h } = computeTargetSize(meta.width, meta.height, opts.maxLongEdge);
  const { canvas, ctx } = makeCanvas(w, h);
  let pixels = new Float32Array(w * h);

  return {
    width: w,
    height: h,
    /** Sample the current video frame. */
    read(video: HTMLVideoElement): PatternImageData {
      // Ensure backing canvas size matches our decode size.
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      if (pixels.length !== w * h) pixels = new Float32Array(w * h);
      rgbaToLuminance(img.data, pixels);
      return { pixels, width: w, height: h };
    },
  };
}

