'use client';

import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ANIMATION } from '@/lib/constants/animation';
import { lockScroll, unlockScroll } from '@/lib/scroll-lock';
import { cn } from '@/lib/utils';

interface IOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Backdrop layout/colour/alignment classes (e.g. centering, dim, blur, padding). */
  className?: string;
  ariaLabel?: string;
  /** Esc + backdrop-click close. Defaults to true. */
  dismissable?: boolean;
}

/**
 * Shared full-screen modal overlay: portals to the body, dims + (optionally)
 * fades in/out, locks page scroll while open, and closes on Escape / backdrop
 * click. The content box — and any inner motion, close button, carousel, etc. —
 * is passed as children. Consumers that keep this mounted (passing `open`) get a
 * fade-out; those that conditionally mount it get fade-in only.
 */
export default function Overlay({
  open,
  onClose,
  children,
  className,
  ariaLabel,
  dismissable = true,
}: IOverlayProps) {
  // Keep the latest onClose in a ref so the Escape listener below doesn't
  // re-subscribe every render when a consumer passes an inline handler. (Kept as
  // a raw ref rather than a useLatest hook so the React Compiler still treats it
  // as stable.)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    lockScroll();
    return () => unlockScroll();
  }, [open]);

  useEffect(() => {
    if (!open || !dismissable) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    // Capture phase so a nested input's own keydown doesn't swallow Escape first.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, dismissable]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn('fz-overlay', className)}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
          onMouseDown={
            dismissable
              ? event => {
                  if (event.target === event.currentTarget) {
                    onClose();
                  }
                }
              : undefined
          }
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
