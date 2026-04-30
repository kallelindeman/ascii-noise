'use client';

import { PALETTE } from '@/lib/palette';

interface SwatchRowProps {
  label: string;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  ariaLabel: string;
}

export function SwatchRow({ label, selectedIdx, onSelect, ariaLabel }: SwatchRowProps) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={ariaLabel}>
        {PALETTE.map((color, idx) => {
          const isActive = idx === selectedIdx;
          return (
            <button
              key={color.name}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`Pick color: ${color.name}`}
              title={`${color.name} ${color.hex}`}
              onClick={() => onSelect(idx)}
              className={[
                'aspect-square w-full rounded-md border border-border transition',
                'hover:scale-105 cursor-pointer',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
              ].filter(Boolean).join(' ')}
              style={{ background: color.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
