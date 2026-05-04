'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Video } from 'lucide-react';
import { Group } from './group';
import { ClipSlider } from './clip-slider';
import { Slider } from '@/components/ui/slider';
import { decodeImageFile } from '@/lib/image';
import type { Settings } from '@/lib/types';
import type { MediaState } from '@/lib/media-types';
import type { PatternCanvasHandle } from '@/components/pattern-canvas';
import { createVideoElement, createVideoLuminanceExtractor, loadVideoMetadata, seekVideo, startVideoFrameLoop } from '@/lib/video';
import { toast } from 'sonner';

interface ImageControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  media: MediaState;
  onMediaChange: React.Dispatch<React.SetStateAction<MediaState>>;
  canvasRef: React.RefObject<PatternCanvasHandle | null>;
}

const ACCEPTED_IMAGE = 'image/png,image/jpeg,image/webp';
const ACCEPTED_VIDEO = 'video/mp4,video/webm,video/quicktime';
const ACCEPTED = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`;

export function ImageControls({ settings, update, media, onMediaChange, canvasRef }: ImageControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoMetaLoadingRef = useRef(false);
  const videoMetaLoading = media.kind === 'video' && (media.duration <= 0 || media.width <= 0 || media.height <= 0);
  const videoUrl = media.kind === 'video' ? media.url : null;
  const videoW = media.kind === 'video' ? media.width : 0;
  const videoH = media.kind === 'video' ? media.height : 0;

  // Lazy-load video metadata when a video is selected.
  useEffect(() => {
    if (media.kind !== 'video') {
      videoElRef.current = null;
      // Reset UI state asynchronously to satisfy strict hook lint rules.
      queueMicrotask(() => {
        setPlaying(false);
      });
      videoMetaLoadingRef.current = false;
      return;
    }
    if (media.duration > 0 && media.width > 0 && media.height > 0) return;
    if (videoMetaLoadingRef.current) return;

    videoMetaLoadingRef.current = true;
    const url = media.url;
    const v = createVideoElement(url);
    videoElRef.current = v;
    void loadVideoMetadata(v)
      .then(({ duration, width, height }) => {
        const safeDuration = Math.max(0, duration);
        onMediaChange((prev) => {
          if (prev.kind !== 'video') return prev;
          if (prev.url !== url) return prev;
          return {
            ...prev,
            duration: safeDuration,
            width,
            height,
            trimStart: Math.min(prev.trimStart, safeDuration),
            trimEnd: prev.trimEnd > 0 ? Math.min(prev.trimEnd, safeDuration) : safeDuration,
          };
        });
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load video metadata');
      })
      .finally(() => { videoMetaLoadingRef.current = false; });
  }, [media, onMediaChange]);

  // Stream video frames → luminance → PatternCanvas (no React state spam).
  useEffect(() => {
    if (media.kind !== 'video') return;
    if (settings.source !== 'media') return;
    if (!videoElRef.current) return;
    if (videoW <= 0 || videoH <= 0) return;
    const handle = canvasRef.current;
    if (!handle) return;

    const extractor = createVideoLuminanceExtractor(
      { width: videoW, height: videoH },
      // Lower decode resolution for smoother playback.
      { maxLongEdge: 384 },
    );

    // First frame (poster) render.
    try {
      handle.setExternalFrameDriving(true);
      handle.setMediaFrame(extractor.read(videoElRef.current));
      handle.requestRender();
    } catch (err) {
      console.error(err);
    }

    const stop = startVideoFrameLoop(videoElRef.current, () => {
      const v = videoElRef.current;
      const h = canvasRef.current;
      if (!v || !h) return;
      h.setMediaFrame(extractor.read(v));
      h.requestRender();
    });
    return () => {
      stop();
      const h = canvasRef.current;
      if (h) {
        h.setExternalFrameDriving(false);
        h.setMediaFrame(null);
      }
    };
  }, [media.kind, videoUrl, videoW, videoH, settings.source, canvasRef]);

  async function loadFile(file: File) {
    if (ACCEPTED_IMAGE.split(',').includes(file.type)) {
      try {
        const data = await decodeImageFile(file);
        const url = URL.createObjectURL(file);
        onMediaChange({
          kind: 'image',
          data,
          previewUrl: url,
          name: file.name,
        });
      } catch (err) {
        console.error(err);
        toast.error('Failed to decode image');
      }
      return;
    }

    if (ACCEPTED_VIDEO.split(',').includes(file.type)) {
      const url = URL.createObjectURL(file);
      onMediaChange({
        kind: 'video',
        file,
        url,
        name: file.name || 'Video',
        duration: 0,
        width: 0,
        height: 0,
        trimStart: 0,
        trimEnd: 0,
      });
      toast.message('Video selected');
      return;
    }

    toast.error('Unsupported file type', {
      description: 'Use PNG, JPEG, WebP, MP4, WebM, or MOV.',
    });
  }

  function handlePick() { fileRef.current?.click(); }

  function handleRemove() {
    onMediaChange({ kind: 'none' });
    if (fileRef.current) fileRef.current.value = '';
  }

  function onDragEnter(e: React.DragEvent) { e.preventDefault(); setDragOver(true); }
  function onDragOver(e: React.DragEvent)  { e.preventDefault(); setDragOver(true); }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragOver(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void loadFile(file);
  }

  const hasImage = media.kind === 'image';
  const hasVideo = media.kind === 'video';
  const hasMedia = media.kind !== 'none';

  return (
    <Group label="Media">
      <div className="space-y-3">
        <button
          type="button"
          aria-label="Upload image or video"
          onClick={handlePick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePick(); } }}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={[
            'w-full rounded-lg overflow-hidden flex items-center justify-center transition',
            'cursor-pointer outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            hasMedia
              ? 'border border-border hover:border-primary'
              : 'border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary',
            dragOver && 'border-primary',
          ].filter(Boolean).join(' ')}
          style={
            hasImage
              ? { backgroundImage: `url(${media.previewUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!hasMedia && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ImageIcon className="h-6 w-6" strokeWidth={1.6} />
              <div className="text-sm font-semibold">Drop image/video here</div>
              <div className="text-xs text-muted-foreground">Or click to upload</div>
            </div>
          )}
          {hasVideo && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Video className="h-6 w-6" strokeWidth={1.6} />
              <div className="text-sm font-semibold">Video selected</div>
              <div className="text-xs text-muted-foreground">{media.name}</div>
              <div className="text-xs text-muted-foreground">Preview + export coming next</div>
            </div>
          )}
        </button>

        {hasMedia && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs font-semibold text-muted-foreground underline decoration-border hover:text-foreground"
            >
              Advanced settings
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-muted-foreground underline decoration-border hover:text-foreground"
            >
              Clear
            </button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); }}
        />
      </div>

      {hasVideo && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={async () => {
                const v = videoElRef.current;
                if (!v) return;
                try {
                  if (v.paused) {
                    await v.play();
                    setPlaying(true);
                  } else {
                    v.pause();
                    setPlaying(false);
                  }
                } catch (err) {
                  console.error(err);
                  toast.error('Failed to play video');
                }
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              onClick={() => {
                const v = videoElRef.current;
                if (!v) return;
                v.pause();
                setPlaying(false);
                void seekVideo(v, media.trimStart).catch((err) => console.error(err));
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Jump to start
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
            <span>{videoMetaLoading ? 'Reading metadata…' : `Duration: ${media.duration.toFixed(2)}s`}</span>
            {media.width > 0 && media.height > 0 && (
              <span>{media.width}×{media.height}</span>
            )}
          </div>

          {media.duration > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Trim</span>
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {media.trimStart.toFixed(2)} – {media.trimEnd.toFixed(2)}s
                </span>
              </div>
              <Slider
                min={0}
                max={media.duration}
                step={0.01}
                value={[media.trimStart, media.trimEnd]}
                minStepsBetweenValues={1}
                onValueChange={(v) => {
                  const arr = v as readonly number[];
                  const lo = Math.max(0, Math.min(arr[0], arr[1] - 0.01));
                  const hi = Math.min(media.duration, Math.max(arr[1], arr[0] + 0.01));
                  onMediaChange((prev) => (prev.kind === 'video' ? { ...prev, trimStart: lo, trimEnd: hi } : prev));
                }}
              />
            </div>
          )}
        </div>
      )}

      {showAdvanced && hasMedia && (
        <ClipSlider
          low={Math.round(settings.clipLow * 100)}
          high={Math.round(settings.clipHigh * 100)}
          onChange={(lo, hi) => update({ clipLow: lo / 100, clipHigh: hi / 100 })}
        />
      )}
    </Group>
  );
}
