import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { save } from '@tauri-apps/plugin-dialog';

import { render, computeCanvasSizeWithLongEdge } from '@/lib/render';
import type { Settings } from '@/lib/types';
import type { MediaState } from '@/lib/media-types';
import { createVideoElement, createVideoLuminanceExtractor, loadVideoMetadata, seekVideo } from '@/lib/video';

export interface NativeExportVideoOptions {
  preset?: '720p' | '1080p';
  fps?: number;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

function presetLongEdge(preset: '720p' | '1080p'): number {
  return preset === '1080p' ? 1920 : 1280;
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function canvasToPngBase64(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to encode PNG'))), 'image/png');
  });
  const buf = await blob.arrayBuffer();
  return arrayBufferToBase64(buf);
}

export async function exportPatternMp4NativeFromVideo(
  settings: Settings,
  media: MediaState,
  opts: NativeExportVideoOptions = {},
): Promise<void> {
  if (media.kind !== 'video') throw new Error('exportPatternMp4NativeFromVideo requires video media');

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

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = outW;
  exportCanvas.height = outH;

  const extractor = createVideoLuminanceExtractor(
    { width: meta.width || media.width, height: meta.height || media.height },
    { maxLongEdge: 1024 },
  );

  const started = await invoke<{ export_id: string }>('native_export_start', {
    args: {
      total_frames: totalFrames,
    },
  });
  const exportId = started.export_id;

  const unlisten = await listen<{ exportId: string; progress: number }>('native-export-progress', (e) => {
    if (e.payload?.exportId !== exportId) return;
    // Encoding stage, mapped to the last 30% of the progress bar.
    const p = 0.7 + 0.3 * Math.max(0, Math.min(1, e.payload.progress));
    opts.onProgress?.(p);
  });

  const cancel = async () => {
    try {
      await invoke('native_export_cancel', { args: { export_id: exportId } });
    } catch {
      // ignore
    }
  };

  try {
    opts.signal?.addEventListener('abort', cancel, { once: true });

    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) throw new Error('Export cancelled');

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

      const pngBase64 = await canvasToPngBase64(exportCanvas);
      await invoke('native_export_write_frame', {
        args: {
          export_id: exportId,
          frame_index: i + 1,
          png_base64: pngBase64,
        },
      });

      opts.onProgress?.(0.7 * (i / totalFrames));
      if (i % 10 === 0) await Promise.resolve();
    }

    const outputPath = await save({
      title: 'Export MP4',
      defaultPath: `pattern-${outW}x${outH}-${trimStart.toFixed(2).replace('.', '_')}-${trimEnd.toFixed(2).replace('.', '_')}.mp4`,
      filters: [{ name: 'MP4', extensions: ['mp4'] }],
    });

    if (!outputPath) {
      throw new Error('Export cancelled');
    }

    await invoke('native_export_finish', {
      args: {
        export_id: exportId,
        output_path: outputPath,
        fps,
      },
    });

    opts.onProgress?.(1);
  } catch (e) {
    await cancel();
    throw e;
  } finally {
    unlisten();
  }
}

export interface NativeExportLoopOptions {
  preset?: '720p' | '1080p';
  fps?: number;
  durationSec: number;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export async function exportPatternLoopMp4Native(
  settings: Settings,
  opts: NativeExportLoopOptions,
): Promise<void> {
  if (settings.speed <= 0) throw new Error('Pattern loop export requires speed > 0');

  const preset = opts.preset ?? '720p';
  const longEdge = presetLongEdge(preset);
  const fps = Math.max(1, Math.round(opts.fps ?? 30));
  const durationSec = Math.max(0.1, opts.durationSec);
  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  const { CW, CH } = computeCanvasSizeWithLongEdge(settings, longEdge);
  const outW = CW;
  const outH = CH;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = outW;
  exportCanvas.height = outH;

  const started = await invoke<{ export_id: string }>('native_export_start', {
    args: { total_frames: totalFrames },
  });
  const exportId = started.export_id;

  const unlisten = await listen<{ exportId: string; progress: number }>('native-export-progress', (e) => {
    if (e.payload?.exportId !== exportId) return;
    const p = 0.7 + 0.3 * Math.max(0, Math.min(1, e.payload.progress));
    opts.onProgress?.(p);
  });

  const cancel = async () => {
    try {
      await invoke('native_export_cancel', { args: { export_id: exportId } });
    } catch {
      // ignore
    }
  };

  try {
    opts.signal?.addEventListener('abort', cancel, { once: true });

    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted) throw new Error('Export cancelled');

      const t = i / fps;
      render({
        canvas: exportCanvas,
        settings,
        image: null,
        zTime: t * settings.speed,
        longEdgeOverride: longEdge,
        renderScaleOverride: 1,
      });

      const pngBase64 = await canvasToPngBase64(exportCanvas);
      await invoke('native_export_write_frame', {
        args: {
          export_id: exportId,
          frame_index: i + 1,
          png_base64: pngBase64,
        },
      });

      opts.onProgress?.(0.7 * (i / totalFrames));
      if (i % 10 === 0) await Promise.resolve();
    }

    const outputPath = await save({
      title: 'Export MP4',
      defaultPath: `pattern-loop-${outW}x${outH}-${durationSec.toFixed(1).replace('.', '_')}s.mp4`,
      filters: [{ name: 'MP4', extensions: ['mp4'] }],
    });

    if (!outputPath) throw new Error('Export cancelled');

    await invoke('native_export_finish', {
      args: {
        export_id: exportId,
        output_path: outputPath,
        fps,
      },
    });

    opts.onProgress?.(1);
  } catch (e) {
    await cancel();
    throw e;
  } finally {
    unlisten();
  }
}

