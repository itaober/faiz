'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface ITooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}

/** Lightweight hover tooltip — wraps a single trigger, reveals a label on hover/focus. */
export default function Tooltip({ label, children, className, side = 'top' }: ITooltipProps) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      {/* Hover-only: focus-triggered tooltips get pinned open after a click
          (focus stays on the button), so we rely on the accessible aria-label
          for keyboard/AT users instead. */}
      <span
        role="tooltip"
        aria-hidden="true"
        className={cn(
          'bg-foreground text-background pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 scale-95 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-md transition duration-150 group-hover/tt:scale-100 group-hover/tt:opacity-100',
          side === 'top'
            ? 'bottom-full mb-2 translate-y-1 group-hover/tt:translate-y-0'
            : 'top-full mt-2 -translate-y-1 group-hover/tt:translate-y-0',
        )}
      >
        {label}
      </span>
    </span>
  );
}
