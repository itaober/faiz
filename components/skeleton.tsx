'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SkeletonProps {
  loading: boolean;
  fallback: ReactNode;
  children: ReactNode;
  loadingLabel?: string;
  className?: string;
}

export default function Skeleton({
  loading,
  fallback,
  children,
  loadingLabel = 'Loading',
  className,
}: SkeletonProps) {
  const transitionClassName = loading
    ? 'transition-none'
    : 'transition-[opacity,filter] duration-(--fz-dur-morph) ease-in-out motion-reduce:transition-none';

  return (
    <div
      className={cn('relative', className)}
      data-state={loading ? 'loading' : 'loaded'}
      aria-busy={loading}
    >
      <span className="sr-only">{loading ? loadingLabel : null}</span>
      {/* Inactive layers are bounded to the box (inset-0 + overflow-hidden) so
          a taller hidden layer can't inflate scrollHeight with phantom
          scrollable space. */}
      <div
        aria-hidden="true"
        inert
        className={cn(
          transitionClassName,
          loading
            ? 'relative opacity-100 blur-0'
            : 'pointer-events-none absolute inset-0 overflow-hidden opacity-0 blur-[2px]',
        )}
      >
        {fallback}
      </div>
      <div
        aria-hidden={loading}
        inert={loading || undefined}
        className={cn(
          transitionClassName,
          loading
            ? 'pointer-events-none absolute inset-0 overflow-hidden opacity-0 blur-[2px]'
            : 'relative opacity-100 blur-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}
