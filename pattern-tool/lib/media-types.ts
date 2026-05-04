import type { ImageData } from './types';

export type MediaState =
  | { kind: 'none' }
  | {
      kind: 'image';
      data: ImageData;
      /** Object URL for UI preview only. */
      previewUrl: string;
      name?: string;
    }
  | {
      kind: 'video';
      /** Original file (kept for export). */
      file: File;
      /** Object URL for a hidden <video> element. */
      url: string;
      name: string;
      duration: number;
      width: number;
      height: number;
      trimStart: number;
      trimEnd: number;
      fpsHint?: number;
    };

