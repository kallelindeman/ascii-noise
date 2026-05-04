import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

import { computeCanvasSizeWithLongEdge, render } from '@/lib/render';
import type { Settings } from '@/lib/types';

export interface ExportPatternLoopOptions {
  preset?: '720p' | '1080p';
  fps?: number;
  durationSec: number;
  onProgress?: (p: number) => void;
}

function presetLongEdge(preset: '720p' | '1080p'): number {
  return preset === '1080p' ? 1920 : 1280;
}

async function pickVideoCodec(width: number, height: number, fps: number): Promise<{
  encoderCodec: string;
  muxerCodec: 'avc' | 'vp9';
}> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not available in this browser');
  }

  const candidates: Array<{ encoderCodec: string; muxerCodec: 'avc' | 'vp9' }> = [
    { encoderCodec: 'avc1.42E01E', muxerCodec: 'avc' },
    { encoderCodec: 'vp09.00.10.08', muxerCodec: 'vp9' },
  ];

  for (const c of candidates) {
    const support = await VideoEncoder.isConfigSupported({
      codec: c.encoderCodec,
      width,
      height,
      framerate: fps,
      bitrate: 8_000_000,
    });
    if (support?.supported) return c;
  }

  throw new Error('No supported video encoder codec found (tried H.264 + VP9)');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Export an MP4 "loop" of the procedural pattern animation.
 *
 * Note: the current noise uses linear `zTime`, so the loop is not mathematically seamless.
 * This exports a bounded-duration clip suitable for looping playback.
 */
export async function exportPatternLoopMp4Browser(
  settings: Settings,
  opts: ExportPatternLoopOptions,
): Promise<void> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('WebCodecs VideoEncoder is not available in this browser');
  }
  if (settings.speed <= 0) {
    throw new Error('Pattern loop export requires speed > 0');
  }

  const preset = opts.preset ?? '720p';
  const longEdge = presetLongEdge(preset);
  const fps = Math.max(1, Math.round(opts.fps ?? 30));
  const durationSec = Math.max(0.1, opts.durationSec);
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  const { CW, CH } = computeCanvasSizeWithLongEdge(settings, longEdge);
  const outW = CW;
  const outH = CH;

  const { encoderCodec, muxerCodec } = await pickVideoCodec(outW, outH, fps);

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
    video: { codec: muxerCodec, width: outW, height: outH, frameRate: fps },
  });

  const exportCanvas = document.createElement('canvas');

  let rejectEncoderError: ((err: Error) => void) | null = null;
  const encoderError = new Promise<never>((_, reject) => { rejectEncoderError = reject; });

  const encoder = new VideoEncoder({
    output: (chunk: EncodedVideoChunk, chunkMeta?: EncodedVideoChunkMetadata) => muxer.addVideoChunk(chunk, chunkMeta),
    error: (e: Error) => rejectEncoderError?.(e),
  });

  encoder.configure({
    codec: encoderCodec,
    width: outW,
    height: outH,
    framerate: fps,
    bitrate: 8_000_000,
    bitrateMode: 'variable',
  });

  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    render({
      canvas: exportCanvas,
      settings,
      image: null,
      zTime: t * settings.speed,
      longEdgeOverride: longEdge,
      renderScaleOverride: 1,
    });

    const tsUs = Math.round(t * 1e6);
    const frame = new VideoFrame(exportCanvas, { timestamp: tsUs });
    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();

    opts.onProgress?.(i / totalFrames);
    if (i % 30 === 0) await Promise.resolve();
  }

  await Promise.race([encoder.flush(), encoderError]);
  encoder.close();
  muxer.finalize();

  const buf = target.buffer;
  if (!buf) throw new Error('MP4 muxer produced no output buffer');
  downloadBlob(new Blob([buf], { type: 'video/mp4' }), `pattern-loop-${outW}x${outH}-${durationSec.toFixed(1).replace('.', '_')}s.mp4`);
}

