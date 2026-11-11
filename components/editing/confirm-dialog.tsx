'use client';

import { useEffect, useId, useRef } from 'react';

import Overlay from '@/components/overlay';

interface IConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loadingLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
}

/** Confirm for a destructive action: the sign-in sheet's look on desktop, a bottom sheet on a phone. */
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
  isLoading = false,
  onConfirm,
}: IConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();

  // Focus starts on Cancel, the safe default when Enter is pressed by habit. Deferred like the
  // other overlays' initial focus, so it lands once the overlay's focus scope has mounted.
  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.setTimeout(() => cancelRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [open]);

  // Escape and the backdrop cancel too, but not while the delete is in flight.
  const cancel = () => {
    if (!isLoading) {
      onOpenChange(false);
    }
  };

  return (
    <Overlay
      open={open}
      onClose={cancel}
      ariaLabel={title}
      ariaDescribedBy={description ? descriptionId : undefined}
      returnFocus
      className="fz-sheet-overlay fz-confirm-overlay"
    >
      <div className="fz-sheet fz-confirm">
        <h3>{title}</h3>
        {description && <p id={descriptionId}>{description}</p>}
        <div className="fz-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="fz-btn fz-btn-ghost"
            onClick={cancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="fz-btn fz-btn-danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
