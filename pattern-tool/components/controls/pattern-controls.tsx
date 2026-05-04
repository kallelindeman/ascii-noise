'use client';

import { useState } from 'react';
import { Group } from './group';
import { SliderRow } from './slider-row';
import type { Settings } from '@/lib/types';
import { ClipSlider } from './clip-slider';

interface PatternControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function PatternControls({ settings, update }: PatternControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Group label="Pattern">
      <SliderRow
        label="Scale"
        value={Math.round(settings.gridsize01 * 100)}
        min={0}
        max={100}
        onChange={(v) => update({ gridsize01: v / 100 })}
      />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs font-semibold text-muted-foreground underline decoration-border hover:text-foreground"
        >
          Advanced settings
        </button>
      </div>

      {showAdvanced && (
        <>
          <SliderRow
            label="Seed"
            value={settings.seed}
            min={0}
            max={999}
            onChange={(v) => update({ seed: v | 0 })}
          />
          <SliderRow
            label="Octaves"
            value={settings.octaves}
            min={1}
            max={8}
            onChange={(v) => update({ octaves: v | 0 })}
          />
          <SliderRow
            label="Warp"
            value={Math.round(settings.warp01 * 100)}
            min={0}
            max={100}
            onChange={(v) => update({ warp01: v / 100 })}
          />
          <SliderRow
            label="Speed"
            value={settings.speed}
            min={0}
            max={3}
            step={0.01}
            onChange={(v) => update({ speed: v })}
            format={(v) => (v === 0 ? '0' : v.toFixed(2))}
          />

          <ClipSlider
            low={Math.round(settings.clipLow * 100)}
            high={Math.round(settings.clipHigh * 100)}
            onChange={(lo, hi) => update({ clipLow: lo / 100, clipHigh: hi / 100 })}
          />
        </>
      )}
    </Group>
  );
}
