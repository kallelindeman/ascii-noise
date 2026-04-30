'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function ComponentsPage() {
  const [switchOn, setSwitchOn] = useState(false);
  const [sliderVal, setSliderVal] = useState(40);
  const [tab, setTab] = useState('a');
  const [selectVal, setSelectVal] = useState<string>('earth');

  const sliderValues = useMemo(() => [sliderVal], [sliderVal]);

  return (
    <main className="h-full overflow-auto bg-background p-8">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Component preview</h1>
          <p className="text-sm text-muted-foreground">
            Gallery of primitives in <code>components/ui</code>.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Variants and sizes</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => toast.success('Default button clicked')}>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button size="icon" aria-label="Icon button">
                +
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Input + label</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="demo-email">Email</Label>
                <Input id="demo-email" placeholder="name@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-file">File</Label>
                <Input id="demo-file" type="file" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select</CardTitle>
              <CardDescription>Popup list, groups, separator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="demo-select">Palette</Label>
              <Select
                value={selectVal}
                onValueChange={(value) => setSelectVal(value ?? 'earth')}
              >
                <SelectTrigger id="demo-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Warm</SelectLabel>
                    <SelectItem value="earth">Earth</SelectItem>
                    <SelectItem value="clay">Clay</SelectItem>
                    <SelectSeparator />
                    <SelectLabel>Cool</SelectLabel>
                    <SelectItem value="sky">Sky</SelectItem>
                    <SelectItem value="ice">Ice</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Current: <span className="font-medium text-foreground">{selectVal}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slider</CardTitle>
              <CardDescription>Single and range thumbs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="demo-slider">Value</Label>
                  <span className="text-sm font-medium text-muted-foreground tabular-nums">{sliderVal}</span>
                </div>
                <Slider
                  id="demo-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={sliderValues}
                  onValueChange={(v) => setSliderVal((v as number[])[0] ?? 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Range</Label>
                <Slider defaultValue={[20, 80]} min={0} max={100} step={1} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Switch</CardTitle>
              <CardDescription>Toggle state</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Enabled: <span className="tabular-nums">{switchOn ? 'Yes' : 'No'}</span>
              </span>
              <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
              <CardDescription>Horizontal tabs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="a" className="flex-1">
                    Tab A
                  </TabsTrigger>
                  <TabsTrigger value="b" className="flex-1">
                    Tab B
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="a" className="pt-3 text-sm text-muted-foreground">
                  Content A
                </TabsContent>
                <TabsContent value="b" className="pt-3 text-sm text-muted-foreground">
                  Content B
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Tooltip + Toast</CardTitle>
              <CardDescription>Hover tooltip and click-to-toast</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Tooltip>
                <TooltipTrigger className={cn(buttonVariants({ variant: 'outline' }))}>
                  Hover me
                </TooltipTrigger>
                <TooltipContent>Tooltip content</TooltipContent>
              </Tooltip>

              <Button
                variant="secondary"
                onClick={() =>
                  toast('Hello from Sonner', {
                    description: 'This uses the global <Toaster /> in app/layout.tsx.',
                  })
                }
              >
                Show toast
              </Button>

              <Button variant="ghost" onClick={() => toast.error('Something went wrong')}>
                Error toast
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

