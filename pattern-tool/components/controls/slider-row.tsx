'use client';

import { Slider } from '@/components/ui/slider';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Optional formatter for the value readout. Defaults to `${v|0}`. */
  format?: (value: number) => string;
}

/**
 * Labeled single-value slider. Label on the left, value readout on the right,
 * track below. Used for every numeric control in the sidebar.
 */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: SliderRowProps) {
  const safeValue = Number.isFinite(value) ? value : min;
  const clampedValue = Math.min(max, Math.max(min, safeValue));
  const display = format ? format(clampedValue) : `${clampedValue | 0}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-sm font-medium text-muted-foreground tabular-nums">{display}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[clampedValue]}
        onValueChange={(v) => {
          const raw =
            typeof v === 'number'
              ? v
              : Array.isArray(v)
                ? v[0]
                : undefined;
          const next = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, next)));
        }}
      />
    </div>
  );
}
