'use client';

import type { ReactNode } from 'react';

interface GroupProps {
  label?: string;
  children: ReactNode;
}

/**
 * Sidebar section. Optional uppercase label with bottom rule, then a
 * vertically stacked list of controls.
 */
export function Group({ label, children }: GroupProps) {
  return (
    <section className="space-y-4">
      {label && (
        <h3 className="border-b border-border pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </h3>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
