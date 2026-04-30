'use client';

import { Group } from './group';
import { Switch } from '@/components/ui/switch';
import type { Settings } from '@/lib/types';
import { PAIRS, PALETTE } from '@/lib/palette';

interface ColorsControlsProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function ColorsControls({ settings, update }: ColorsControlsProps) {
  return (
    <Group label="Colors">
      <div className="space-y-2">
        <span className="text-sm font-semibold text-foreground">Pairs</span>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Color pair">
          {PAIRS.slice(0, 4).map((pair, idx) => {
            const isActive = idx === settings.pairIdx;
            const fg = PALETTE[pair.fgIdx]?.hex ?? '#000';
            const bg = PALETTE[pair.bgIdx]?.hex ?? '#fff';
            return (
              <button
                key={pair.name}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={`Pick pair: ${pair.name}`}
                title={pair.name}
                onClick={() => update({ pairIdx: idx })}
                className={[
                  'flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 transition',
                  'hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-card',
                ].filter(Boolean).join(' ')}
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 overflow-hidden rounded-sm border border-border"
                  style={{ gridTemplateRows: '1fr 1fr' }}
                >
                  <span style={{ background: fg }} />
                  <span style={{ background: bg }} />
                </span>
                <span className="text-xs font-semibold text-foreground leading-tight">
                  {pair.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Invert</span>
        <Switch
          checked={settings.invert}
          onCheckedChange={(checked) => update({ invert: checked })}
        />
      </div>
    </Group>
  );
}
