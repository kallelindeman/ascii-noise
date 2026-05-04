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
import { exportPatternMp4FromVideo } from '@/lib/export/video-export';
import { toast } from 'sonner';

export default function Page() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [media, setMedia]       = useState<MediaState>({ kind: 'none' });
  const [exporting, setExporting] = useState(false);
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
    if (media.kind === 'video') {
      if (exporting) return;
      setExporting(true);
      const t = toast.loading('Exporting MP4…');
      try {
        await exportPatternMp4FromVideo(settings, media, {
          preset: '720p',
          onProgress: (p) => toast.loading(`Exporting MP4… ${Math.round(p * 100)}%`, { id: t }),
        });
        toast.success('MP4 exported', { id: t });
      } catch (err) {
        console.error(err);
        toast.error('MP4 export failed', { id: t });
      } finally {
        setExporting(false);
      }
      return;
    }

    const a = document.createElement('a');
    a.download = `pattern-${canvas.width}x${canvas.height}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }, [exporting, media, settings]);

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
          <Button
            onClick={handleDownload}
            disabled={exporting}
            className="w-full rounded-full font-semibold tracking-wide"
            size="lg"
          >
            {media.kind === 'video' ? (exporting ? 'Exporting MP4…' : 'Export MP4') : 'Download pattern'}
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
