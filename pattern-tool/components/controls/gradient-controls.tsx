'use client';

import { Group } from './group';
import { SliderRow } from './slider-row';
import { Switch } from '@/components/ui/switch';
import type { Settings } from '@/lib/types';

interface GradientControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function GradientControls({ settings, update }: GradientControlsProps) {
  return (
    <Group label="Mask">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Enable</span>
        <Switch
          checked={settings.gradient}
          onCheckedChange={(checked) => update({ gradient: checked })}
        />
      </div>

      {settings.gradient && (
        <>
          <SliderRow
            label="Direction"
            value={settings.gradientAngle}
            min={0}
            max={360}
            onChange={(v) => update({ gradientAngle: v | 0 })}
            format={(v) => `${v | 0}°`}
          />
          <SliderRow
            label="Position"
            value={settings.gradientPos}
            min={0}
            max={100}
            onChange={(v) => update({ gradientPos: v | 0 })}
          />
          <SliderRow
            label="Fade"
            value={settings.gradientFade}
            min={0}
            max={100}
            onChange={(v) => update({ gradientFade: v | 0 })}
          />
          <SliderRow
            label="Edge noise"
            value={settings.gradientEdge}
            min={0}
            max={100}
            onChange={(v) => update({ gradientEdge: v | 0 })}
          />
          <SliderRow
            label="Edge scale"
            value={settings.gradientEdgeScale}
            min={0}
            max={100}
            onChange={(v) => update({ gradientEdgeScale: v | 0 })}
          />
        </>
      )}
    </Group>
  );
}
