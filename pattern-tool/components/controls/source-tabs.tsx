'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Source } from '@/lib/types';

interface SourceTabsProps {
  source: Source;
  onChange: (source: Source) => void;
}

export function SourceTabs({ source, onChange }: SourceTabsProps) {
  return (
    <Tabs value={source} onValueChange={(v) => onChange(v as Source)}>
      <TabsList className="w-full">
        <TabsTrigger value="pattern" className="flex-1">Pattern</TabsTrigger>
        <TabsTrigger value="media"   className="flex-1">Media</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
