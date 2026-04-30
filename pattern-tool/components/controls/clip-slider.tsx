'use client';

import { Slider } from '@/components/ui/slider';

interface ClipSliderProps {
  /** Current low value, 0..100 */
  low: number;
  /** Current high value, 0..100 */
  high: number;
  onChange: (low: number, high: number) => void;
}

/**
 * Dual-thumb range slider for tonal clip. shadcn's Slider (Radix) natively
 * supports multiple thumbs when given an array value; we just enforce a
 * 1-unit minimum gap so the render math never divides by zero.
 */
export function ClipSlider({ low, high, onChange }: ClipSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Clip</span>
        <span className="text-sm font-medium text-muted-foreground tabular-nums">
          {low | 0} – {high | 0}
        </span>
      </div>
      <Slider
        min={0}
        max={100}
        step={1}
        value={[low, high]}
        minStepsBetweenValues={1}
        onValueChange={(v) => {
          const arr = v as readonly number[];
          const lo = Math.min(arr[0], arr[1] - 1);
          const hi = Math.max(arr[1], arr[0] + 1);
          onChange(lo, hi);
        }}
      />
    </div>
  );
}
