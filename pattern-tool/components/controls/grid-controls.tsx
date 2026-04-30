'use client';

import { Group } from './group';
import { SliderRow } from './slider-row';
import type { Settings } from '@/lib/types';

interface GridControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function GridControls({ settings, update }: GridControlsProps) {
  return (
    <Group label="Global · Grid">
      <SliderRow
        label="Symbol size"
        value={Math.round(settings.scale01 * 100)}
        min={0}
        max={100}
        onChange={(v) => update({ scale01: v / 100 })}
      />
      <SliderRow
        label="Number of symbols"
        value={settings.symbols}
        min={1}
        max={5}
        onChange={(v) => update({ symbols: v | 0 })}
      />
    </Group>
  );
}
