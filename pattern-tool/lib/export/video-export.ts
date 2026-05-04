import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

import { render, computeCanvasSizeWithLongEdge } from '@/lib/render';
import type { Settings } from '@/lib/types';
import type { MediaState } from '@/lib/media-types';
import { createVideoElement, createVideoLuminanceExtractor, loadVideoMetadata, seekVideo } from '@/lib/video';

export type VideoExportPreset = '720p' | '1080p';

export interface ExportVideoOptions {
  preset?: VideoExportPreset;
  /** Fallback fps when we can’t infer it. */
  fps?: number;
  /** Called with a value in [0, 1]. */
  onProgress?: (p: number) => void;
}

function presetLongEdge(preset: VideoExportPreset): number {
  return preset === '1080p' ? 1920 : 1280;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Let the download start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function pickVideoCodec(width: number, height: number, fps: number): Promise<{
  encoderCodec: string;
  muxerCodec: 'avc' | 'vp9';
}> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not available in this browser');
  }

  const candidates: Array<{ encoderCodec: string; muxerCodec: 'avc' | 'vp9' }> = [
    { encoderCodec: 'avc1.42E01E', muxerCodec: 'avc' }, // H.264 baseline
    { encoderCodec: 'vp09.00.10.08', muxerCodec: 'vp9' }, // VP9 profile 0, 8-bit
  ];

  for (const c of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: c.encoderCodec,
      width,
      height,
      framerate: fps,
      bitrate: 6_000_000,
    });
    if (support?.supported) return c;
  }

  throw new Error('No supported video encoder codec found (tried H.264 + VP9)');
}

export async function exportPatternMp4FromVideo(
  settings: Settings,
  media: MediaState,
  opts: ExportVideoOptions = {},
): Promise<void> {
  if (media.kind !== 'video') throw new Error('exportPatternMp4FromVideo requires video media');
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not available in this browser');
  }

  const preset = opts.preset ?? '720p';
  const longEdge = presetLongEdge(preset);
  const fps = Math.max(1, Math.round(opts.fps ?? media.fpsHint ?? 30));

  const v = createVideoElement(media.url);
  const meta = await loadVideoMetadata(v);
  const duration = meta.duration || media.duration || 0;

  const trimStart = clamp(media.trimStart ?? 0, 0, Math.max(0, duration));
  const trimEnd = clamp(media.trimEnd ?? duration, trimStart, Math.max(trimStart, duration));
  const exportDuration = Math.max(0, trimEnd - trimStart);
  const totalFrames = Math.max(1, Math.ceil(exportDuration * fps));

  const { CW, CH } = computeCanvasSizeWithLongEdge(settings, longEdge);
  const outW = CW;
  const outH = CH;

  const { encoderCodec, muxerCodec } = await pickVideoCodec(outW, outH, fps);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: {
      codec: muxerCodec,
      width: outW,
      height: outH,
      frameRate: fps,
    },
  });

  const exportCanvas = document.createElement('canvas');

  let rejectEncoderError: ((err: Error) => void) | null = null;
  const encoderError = new Promise<never>((_, reject) => { rejectEncoderError = reject; });

  const encoder = new VideoEncoder({
    output: (chunk: EncodedVideoChunk, chunkMeta?: EncodedVideoChunkMetadata) => {
      muxer.addVideoChunk(chunk, chunkMeta);
    },
    error: (e: Error) => {
      rejectEncoderError?.(e);
    },
  });

  encoder.configure({
    codec: encoderCodec,
    width: outW,
    height: outH,
    framerate: fps,
    bitrate: 6_000_000,
    bitrateMode: 'variable',
  });

  const extractor = createVideoLuminanceExtractor(
    { width: meta.width || media.width, height: meta.height || media.height },
    { maxLongEdge: 1024 },
  );

  for (let i = 0; i < totalFrames; i++) {
    const t = trimStart + (i / fps);
    await seekVideo(v, t);
    const lum = extractor.read(v);

    render({
      canvas: exportCanvas,
      settings,
      image: lum,
      zTime: settings.speed > 0 ? t * settings.speed : 0,
      longEdgeOverride: longEdge,
      renderScaleOverride: 1,
    });

    const tsUs = Math.round((t - trimStart) * 1e6);
    const frame = new VideoFrame(exportCanvas, { timestamp: tsUs });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();

    opts.onProgress?.(i / totalFrames);
    // Yield occasionally so the UI can breathe on long exports.
    if (i % 30 === 0) await Promise.resolve();
  }

  await Promise.race([encoder.flush(), encoderError]);
  encoder.close();

  muxer.finalize();

  const buf = target.buffer;
  if (!buf) throw new Error('MP4 muxer produced no output buffer');

  const blob = new Blob([buf], { type: 'video/mp4' });
  const safeStart = trimStart.toFixed(2).replace('.', '_');
  const safeEnd = trimEnd.toFixed(2).replace('.', '_');
  downloadBlob(blob, `pattern-${outW}x${outH}-${safeStart}-${safeEnd}.mp4`);
}

