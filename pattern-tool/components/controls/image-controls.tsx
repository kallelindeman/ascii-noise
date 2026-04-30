'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Video } from 'lucide-react';
import { Group } from './group';
import { ClipSlider } from './clip-slider';
import { decodeImageFile } from '@/lib/image';
import type { ImageData as PatternImageData, Settings } from '@/lib/types';
import { toast } from 'sonner';

interface ImageControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  image: PatternImageData | null;
  onImageChange: (image: PatternImageData | null) => void;
}

const ACCEPTED_IMAGE = 'image/png,image/jpeg,image/webp';
const ACCEPTED_VIDEO = 'video/mp4,video/webm,video/quicktime';
const ACCEPTED = `${ACCEPTED_IMAGE},${ACCEPTED_VIDEO}`;

export function ImageControls({ settings, update, image, onImageChange }: ImageControlsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [videoName, setVideoName] = useState<string | null>(null);

  // Manage object URL lifecycle for the thumbnail preview
  useEffect(() => () => { if (thumbUrl) URL.revokeObjectURL(thumbUrl); }, [thumbUrl]);

  async function loadFile(file: File) {
    if (ACCEPTED_IMAGE.split(',').includes(file.type)) {
      try {
        const data = await decodeImageFile(file);
        const url = URL.createObjectURL(file);
        if (thumbUrl) URL.revokeObjectURL(thumbUrl);
        setThumbUrl(url);
        setVideoName(null);
        onImageChange(data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to decode image');
      }
      return;
    }

    if (ACCEPTED_VIDEO.split(',').includes(file.type)) {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
      setThumbUrl(null);
      onImageChange(null);
      setVideoName(file.name || 'Video');
      toast.message('Video input is coming soon');
      return;
    }

    toast.error('Unsupported file type', {
      description: 'Use PNG, JPEG, WebP, MP4, WebM, or MOV.',
    });
  }

  function handlePick() { fileRef.current?.click(); }

  function handleRemove() {
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    setThumbUrl(null);
    onImageChange(null);
    setVideoName(null);
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

  const hasImage = image !== null;
  const hasVideo = !hasImage && videoName !== null;
  const hasMedia = hasImage || hasVideo;

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
            hasImage && thumbUrl
              ? { backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
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
              <div className="text-xs text-muted-foreground">{videoName}</div>
              <div className="text-xs text-muted-foreground">Support coming soon</div>
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

      {showAdvanced && hasImage && (
        <ClipSlider
          low={Math.round(settings.clipLow * 100)}
          high={Math.round(settings.clipHigh * 100)}
          onChange={(lo, hi) => update({ clipLow: lo / 100, clipHigh: hi / 100 })}
        />
      )}
    </Group>
  );
}
