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
    const imageRef    = useRef(image);
    settingsRef.current = settings;
    imageRef.current    = image;

    useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }), []);

    // Schedule a render via rAF. Dropping or coalescing extra frames is fine
    // because we always read the freshest settings from the ref at flush time.
    useEffect(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const canvas = canvasRef.current;
        if (!canvas) return;
        render({
          canvas,
          settings: settingsRef.current,
          image: imageRef.current,
          zTime: zTime.current,
        });
      });
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
            image: imageRef.current,
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
