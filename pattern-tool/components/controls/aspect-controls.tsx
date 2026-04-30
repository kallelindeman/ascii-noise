'use client';

import { Group } from './group';
import { SliderRow } from './slider-row';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AspectPreset, Settings } from '@/lib/types';

interface AspectControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const PRESETS: { value: AspectPreset; label: string }[] = [
  { value: '16:9',   label: '16:9'   },
  { value: '1:1',    label: '1:1'    },
  { value: '9:16',   label: '9:16'   },
  { value: '4:5',    label: '4:5'    },
  { value: '3:2',    label: '3:2'    },
  { value: 'custom', label: 'Custom' },
];

export function AspectControls({ settings, update }: AspectControlsProps) {
  return (
    <Group label="Aspect ratio">
      <div className="space-y-2">
        <Label htmlFor="aspect-select">Aspect</Label>
        <Select
          value={settings.aspect}
          onValueChange={(v) => update({ aspect: v as AspectPreset })}
        >
          <SelectTrigger id="aspect-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {settings.aspect === 'custom' && (
        <div className="flex gap-3">
          <div className="flex-1">
            <SliderRow
              label="W"
              value={settings.aspectW}
              min={1}
              max={100}
              onChange={(v) => update({ aspectW: v | 0 })}
            />
          </div>
          <div className="flex-1">
            <SliderRow
              label="H"
              value={settings.aspectH}
              min={1}
              max={100}
              onChange={(v) => update({ aspectH: v | 0 })}
            />
          </div>
        </div>
      )}
    </Group>
  );
}
