'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface ISegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /**
   * Unique motion layout id for the sliding pill, so two segmented controls on
   * screen at once animate independently.
   */
  layoutId: string;
  className?: string;
}

// Snappy pill, tuned specifically for this control (distinct from ANIMATION.spring).
const PILL_TRANSITION = { type: 'spring', stiffness: 500, damping: 40 } as const;

/** iOS-style segmented control with a shared-layout sliding pill (`.fz-seg`). */
export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  className,
}: ISegmentedProps<T>) {
  return (
    <div className={cn('fz-seg', className)}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            data-active={active || undefined}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="fz-seg-active"
                transition={PILL_TRANSITION}
              />
            ) : null}
            <span className="relative z-[1] block truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
