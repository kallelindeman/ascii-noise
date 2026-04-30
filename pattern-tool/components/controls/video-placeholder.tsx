'use client';

import { Video } from 'lucide-react';
import { Group } from './group';

export function VideoPlaceholder() {
  return (
    <Group label="Video">
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-background py-8 px-4 text-center text-muted-foreground">
        <Video className="h-7 w-7 opacity-60" strokeWidth={1.6} />
        <div className="text-sm font-semibold text-foreground">Video input — coming soon</div>
        <div className="text-xs leading-relaxed">
          Falling back to pattern noise for now.
        </div>
      </div>
    </Group>
  );
}
