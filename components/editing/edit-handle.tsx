'use client';

import { PencilIcon } from 'lucide-react';
import type { CSSProperties } from 'react';

import { cn } from '@/lib/utils';

interface IEditHandleProps {
  onClick: () => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  label?: string;
  style?: CSSProperties;
  className?: string;
}

/**
 * The gutter edit affordance — a quiet pencil that lives in the left margin and
 * reveals on hover of its `.fz-edit-row` ancestor. Never floats over content.
 */
export default function EditHandle({
  onClick,
  onPointerEnter,
  onFocus,
  label = 'Edit',
  style,
  className,
}: IEditHandleProps) {
  return (
    <button
      type="button"
      className={cn('fz-handle', className)}
      style={style}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
      title={label}
      aria-label={label}
    >
      <PencilIcon className="size-[13px]" />
    </button>
  );
}
