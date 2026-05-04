'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { render } from '@/lib/render';
import type { ImageData as PatternImageData, Settings } from '@/lib/types';

interface PatternCanvasProps {
  settings: Settings;
  image: PatternImageData | null;
  className?: string;
}

export interface PatternCanvasHandle {
  /** Returns the underlying canvas element (for export). */
  getCanvas: () => HTMLCanvasElement | null;
  /** Imperatively update the media luminance buffer (for video). */
  setMediaFrame: (frame: PatternImageData | null) => void;
  /** If true, disables internal speed-based animation loop (video drives frames). */
  setExternalFrameDriving: (driving: boolean) => void;
  /** Request a render on the next animation frame. */
  requestRender: () => void;
}

/**
 * Imperative canvas wrapper.
 *
 *   - Owns a single <canvas> element via ref.
 *   - Schedules a render whenever settings or image change, coalesced into
 *     a single requestAnimationFrame so dragging a slider produces at most
 *     one render per frame.
 *   - Runs an animation loop only when settings.speed > 0; the loop
 *     advances zTime and renders directly each frame.
 *   - Pixel state never enters React.
 */
export const PatternCanvas = forwardRef<PatternCanvasHandle, PatternCanvasProps>(
  function PatternCanvas({ settings, image, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef    = useRef<number | null>(null);
    const animRef   = useRef<number | null>(null);
    const animLast  = useRef<number>(0);
    const zTime     = useRef<number>(0);

    // Latest values, accessed by the rAF loop without rebinding listeners.
    const settingsRef = useRef(settings);
    const propImageRef = useRef<PatternImageData | null>(image);
    const mediaFrameRef = useRef<PatternImageData | null>(null);
    const externalDrivingRef = useRef(false);
    settingsRef.current = settings;
    propImageRef.current = image;

    const effectiveImage = () => mediaFrameRef.current ?? propImageRef.current;

    const scheduleRender = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const canvas = canvasRef.current;
        if (!canvas) return;
        render({
          canvas,
          settings: settingsRef.current,
          image: effectiveImage(),
          zTime: zTime.current,
        });
      });
    };

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      setMediaFrame: (frame) => {
        mediaFrameRef.current = frame;
      },
      setExternalFrameDriving: (driving) => {
        externalDrivingRef.current = driving;
      },
      requestRender: () => scheduleRender(),
    }), []);

    // Schedule a render via rAF. Dropping or coalescing extra frames is fine
    // because we always read the freshest settings from the ref at flush time.
    useEffect(() => {
      scheduleRender();
      return () => {
        if (rafRef.current != null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }, [settings, image]);

    // Animation: runs only when speed > 0. Advances zTime and renders inline.
    useEffect(() => {
      const stop = () => {
        if (animRef.current != null) {
          cancelAnimationFrame(animRef.current);
          animRef.current = null;
          animLast.current = 0;
        }
      };

      if (settings.speed <= 0) {
        stop();
        return;
      }

      const tick = (now: number) => {
        // When a video is actively driving frames, do not also run the speed-based
        // animation loop — it causes double renders and stutter.
        if (externalDrivingRef.current && settingsRef.current.source === 'media') {
          stop();
          return;
        }
        const s = settingsRef.current;
        if (s.speed <= 0) {
          stop();
          return;
        }
        if (!animLast.current) animLast.current = now;
        const dt = Math.min(0.05, (now - animLast.current) / 1000);
        animLast.current = now;
        zTime.current += s.speed * dt;

        const canvas = canvasRef.current;
        if (canvas) {
          render({
            canvas,
            settings: s,
            image: effectiveImage(),
            zTime: zTime.current,
          });
        }
        animRef.current = requestAnimationFrame(tick);
      };

      animRef.current = requestAnimationFrame(tick);
      return stop;
    }, [settings.speed]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        // CSS sizing only — pixel dims set by render() to (CW × RS, CH × RS)
        style={{
          display: 'block',
          maxWidth: '100%',
          maxHeight: '100%',
          borderRadius: 4,
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        }}
      />
    );
  },
);
