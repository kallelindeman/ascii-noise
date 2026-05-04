'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PatternCanvas, type PatternCanvasHandle } from '@/components/pattern-canvas';
import { SourceTabs } from '@/components/controls/source-tabs';
import { PatternControls } from '@/components/controls/pattern-controls';
import { ImageControls } from '@/components/controls/image-controls';
import { GridControls } from '@/components/controls/grid-controls';
import { AspectControls } from '@/components/controls/aspect-controls';
import { GradientControls } from '@/components/controls/gradient-controls';
import { ColorsControls } from '@/components/controls/colors-controls';
import { DEFAULT_SETTINGS, type Settings } from '@/lib/types';
import type { MediaState } from '@/lib/media-types';
import { exportPatternLoopMp4Browser } from '@/lib/export/pattern-loop-export';
import { exportPatternLoopMp4Native, exportPatternMp4NativeFromVideo } from '@/lib/export/native-video-export';
import { exportPatternMp4FromVideo } from '@/lib/export/video-export';
import { isTauri } from '@/lib/tauri';
import { toast } from 'sonner';
import { Slider } from '@/components/ui/slider';

export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [media, setMedia]       = useState<MediaState>({ kind: 'none' });
  const [exporting, setExporting] = useState(false);
  const desktop = isTauri();
  const [exportMode, setExportMode] = useState<'browser' | 'native'>(desktop ? 'native' : 'browser');
  const [exportType, setExportType] = useState<'png' | 'mp4'>('png');
  const [loopSeconds, setLoopSeconds] = useState(5);
  const [exportScale, setExportScale] = useState<1 | 2 | 4>(2);
  const exportAbort = useRef<AbortController | null>(null);
  const canvasRef               = useRef<PatternCanvasHandle>(null);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  // Revoke object URLs safely:
  // - only when the underlying URL string changes, or when media is cleared
  // - never on metadata-only updates (same URL), which would break in-flight loads
  const lastImageUrl = useRef<string | null>(null);
  const lastVideoUrl = useRef<string | null>(null);
  useEffect(() => {
    if (media.kind === 'image') {
      if (lastImageUrl.current && lastImageUrl.current !== media.previewUrl) {
        URL.revokeObjectURL(lastImageUrl.current);
      }
      lastImageUrl.current = media.previewUrl;
      if (lastVideoUrl.current) {
        URL.revokeObjectURL(lastVideoUrl.current);
        lastVideoUrl.current = null;
      }
      return;
    }

    if (media.kind === 'video') {
      if (lastVideoUrl.current && lastVideoUrl.current !== media.url) {
        URL.revokeObjectURL(lastVideoUrl.current);
      }
      lastVideoUrl.current = media.url;
      if (lastImageUrl.current) {
        URL.revokeObjectURL(lastImageUrl.current);
        lastImageUrl.current = null;
      }
      return;
    }

    // none
    if (lastImageUrl.current) {
      URL.revokeObjectURL(lastImageUrl.current);
      lastImageUrl.current = null;
    }
    if (lastVideoUrl.current) {
      URL.revokeObjectURL(lastVideoUrl.current);
      lastVideoUrl.current = null;
    }
  }, [media]);

  const handleDownload = useCallback(async () => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    if (exportType === 'mp4') {
      const videoDriven = media.kind === 'video' && settings.source === 'media';
      // MP4 loop export disabled when speed is 0, but video-driven export is allowed.
      if (!videoDriven && settings.speed <= 0) return;
      if (exporting) {
        exportAbort.current?.abort();
        return;
      }
      setExporting(true);
      const t = toast.loading('Exporting MP4…');
      const ac = new AbortController();
      exportAbort.current = ac;
      try {
        if (videoDriven) {
          if (desktop && exportMode === 'native') {
            await exportPatternMp4NativeFromVideo(settings, media, {
              renderScale: exportScale,
              signal: ac.signal,
              onProgress: (p) => toast.loading(`Exporting MP4… ${Math.round(p * 100)}%`, { id: t }),
            });
          } else {
            await exportPatternMp4FromVideo(settings, media, {
              renderScale: exportScale,
              onProgress: (p) => toast.loading(`Exporting MP4… ${Math.round(p * 100)}%`, { id: t }),
            });
          }
        } else if (desktop && exportMode === 'native') {
          await exportPatternLoopMp4Native(settings, {
            renderScale: exportScale,
            signal: ac.signal,
            onProgress: (p) => toast.loading(`Exporting MP4… ${Math.round(p * 100)}%`, { id: t }),
            durationSec: loopSeconds,
          });
        } else {
          await exportPatternLoopMp4Browser(settings, {
            renderScale: exportScale,
            onProgress: (p) => toast.loading(`Exporting MP4… ${Math.round(p * 100)}%`, { id: t }),
            durationSec: loopSeconds,
          });
        }
        toast.success('MP4 exported', { id: t });
      } catch (err) {
        console.error(err);
        toast.error((ac.signal.aborted ? 'MP4 export cancelled' : 'MP4 export failed'), { id: t });
      } finally {
        setExporting(false);
        exportAbort.current = null;
      }
      return;
    }

    // PNG export: resample the current preview canvas to requested scale.
    // This guarantees the PNG matches what you're seeing (including video-driven frames).
    const baseLongEdge = 2048;
    const targetLongEdge = baseLongEdge * exportScale;
    const curLongEdge = Math.max(canvas.width, canvas.height);
    const k = targetLongEdge / curLongEdge;
    const outW = Math.max(1, Math.round(canvas.width * k));
    const outH = Math.max(1, Math.round(canvas.height * k));

    const out = document.createElement('canvas');
    out.width = outW;
    out.height = outH;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, outW, outH);

    const a = document.createElement('a');
    a.download = `pattern-${out.width}x${out.height}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  }, [exportType, exporting, loopSeconds, desktop, exportMode, settings, media, exportScale]);

  const imageForRender = media.kind === 'image' ? media.data : null;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-80 min-w-80 flex-col border-r border-border bg-card">
        <header className="border-b border-border px-6 pt-5 pb-4 text-sm font-medium text-muted-foreground tracking-wide">
          ABC Labs Pattern Generator
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <SourceTabs
            source={settings.source}
            onChange={(source) => update({ source })}
          />

          {settings.source === 'pattern' && (
            <PatternControls settings={settings} update={update} />
          )}
          {settings.source === 'media' && (
            <ImageControls
              settings={settings}
              update={update}
              media={media}
              onMediaChange={setMedia}
              canvasRef={canvasRef}
            />
          )}

          <GridControls     settings={settings} update={update} />
          <AspectControls   settings={settings} update={update} />
          <GradientControls settings={settings} update={update} />
          <ColorsControls   settings={settings} update={update} />
        </div>

        <footer className="border-t border-border px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Transparent background</span>
            <Switch
              checked={settings.transparent}
              onCheckedChange={(checked) => update({ transparent: checked })}
            />
          </div>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Export as</span>
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={exportType}
              onChange={(e) => setExportType(e.target.value as 'png' | 'mp4')}
              disabled={exporting}
            >
              <option value="png">Image (PNG)</option>
              <option value="mp4">Video (MP4 loop)</option>
            </select>
          </label>

          {exportType === 'mp4' && (
            <div className="mb-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Resolution</span>
                <select
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                  value={String(exportScale)}
                  onChange={(e) => setExportScale((parseInt(e.target.value, 10) as 1 | 2 | 4) || 2)}
                  disabled={exporting}
                >
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
              </label>

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Loop duration</span>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{loopSeconds}s</span>
              </div>
              <Slider
                min={3}
                max={15}
                step={1}
                value={[loopSeconds]}
                onValueChange={(v) => setLoopSeconds((v as number[])[0] ?? 5)}
              />
              {desktop && (
                <div className="pt-1">
                  <select
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                    value={exportMode}
                    onChange={(e) => setExportMode(e.target.value as 'browser' | 'native')}
                    disabled={exporting}
                  >
                    <option value="native">MP4 encoder: Native (FFmpeg)</option>
                    <option value="browser">MP4 encoder: Browser (WebCodecs)</option>
                  </select>
                </div>
              )}
              {settings.speed <= 0 && (
                <div className="text-xs text-muted-foreground">
                  MP4 loop export is disabled when speed is 0. Increase speed to export a loop.
                </div>
              )}
            </div>
          )}
          {exportType === 'png' && (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Resolution</span>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={String(exportScale)}
                onChange={(e) => setExportScale((parseInt(e.target.value, 10) as 1 | 2 | 4) || 2)}
                disabled={exporting}
              >
                <option value="1">1×</option>
                <option value="2">2×</option>
                <option value="4">4×</option>
              </select>
            </label>
          )}
          <Button
            onClick={handleDownload}
            disabled={exporting || (exportType === 'mp4' && !(media.kind === 'video' && settings.source === 'media') && settings.speed <= 0)}
            className="w-full rounded-full font-semibold tracking-wide"
            size="lg"
          >
            {exportType === 'mp4'
              ? (exporting ? 'Cancel export' : ((media.kind === 'video' && settings.source === 'media') ? 'Export MP4 (video)' : 'Export MP4 loop'))
              : 'Download PNG'}
            <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
          </Button>
        </footer>
      </aside>

      {/* Stage */}
      <main
        className={[
          'flex flex-1 items-center justify-center overflow-hidden p-8',
          settings.transparent && 'stage-checker',
        ].filter(Boolean).join(' ')}
      >
        <PatternCanvas ref={canvasRef} settings={settings} image={imageForRender} />
      </main>
    </div>
  );
}
