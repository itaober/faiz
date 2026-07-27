'use client';

import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ANIMATION } from '@/lib/constants/animation';
import { lockScroll, type ScrollLockMode, unlockScroll } from '@/lib/scroll-lock';
import { cn } from '@/lib/utils';

interface IOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Dialog layout/alignment classes (e.g. centering and padding). */
  className?: string;
  /** Optional backdrop layer kept separate so content can animate at full opacity. */
  backdropClassName?: string;
  /** Controls the backdrop independently while the modal and scroll lock stay active. */
  backdropOpen?: boolean;
  ariaLabel?: string;
  /** Esc + backdrop-click close. Defaults to true. */
  dismissable?: boolean;
  /** Use overflow locking when shared-layout children must keep viewport coordinates. */
  scrollLockMode?: ScrollLockMode;
  /** Fires after the fade-out finishes — lets consumers unmount post-exit. */
  onExitComplete?: () => void;
  /** Keep the portal content mounted while this Overlay remains mounted. */
  persistent?: boolean;
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
  backdropClassName,
  backdropOpen,
  ariaLabel,
  dismissable = true,
  scrollLockMode = 'fixed',
  onExitComplete,
  persistent = false,
}: IOverlayProps) {
  // Keep the latest onClose in a ref so the Escape listener below doesn't
  // re-subscribe every render when a consumer passes an inline handler. (Kept as
  // a raw ref rather than a useLatest hook so the React Compiler still treats it
  // as stable.)
  const onCloseRef = useRef(onClose);
  const scrollLockedRef = useRef(false);
  const lockedModeRef = useRef<ScrollLockMode | null>(null);
  const wasOpenRef = useRef(open);
  const resolvedBackdropOpen = backdropOpen ?? open;
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    if (open) {
      wasOpenRef.current = true;
    }
  }, [onClose, open]);

  const releaseScrollLock = useCallback(() => {
    if (!scrollLockedRef.current || !lockedModeRef.current) {
      return;
    }
    unlockScroll(lockedModeRef.current);
    scrollLockedRef.current = false;
    lockedModeRef.current = null;
  }, []);

  useEffect(() => {
    if (!open || scrollLockedRef.current) {
      return;
    }
    lockScroll(scrollLockMode);
    scrollLockedRef.current = true;
    lockedModeRef.current = scrollLockMode;

    return releaseScrollLock;
  }, [open, releaseScrollLock, scrollLockMode]);

  useEffect(() => releaseScrollLock, [releaseScrollLock]);

  useLayoutEffect(() => {
    if (!open || !dismissable) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    // Install before paint so Escape can reverse even the first opening frame.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, dismissable]);

  const handleExitComplete = useCallback(() => {
    if (!wasOpenRef.current) {
      return;
    }
    wasOpenRef.current = false;
    onExitComplete?.();
  }, [onExitComplete]);

  if (typeof document === 'undefined') {
    return null;
  }

  if (persistent) {
    return createPortal(
      <div
        className={cn('fz-overlay', !open && 'invisible pointer-events-none', className)}
        role="dialog"
        aria-modal={open ? 'true' : undefined}
        aria-hidden={!open}
        aria-label={ariaLabel}
      >
        <AnimatePresence>
          {resolvedBackdropOpen ? (
            <motion.div
              key="backdrop"
              aria-hidden="true"
              className={cn('absolute inset-0', backdropClassName)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
              onMouseDown={dismissable ? onClose : undefined}
            />
          ) : null}
        </AnimatePresence>
        {children}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open ? (
        <motion.div
          layoutRoot
          className={cn('fz-overlay', className)}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          initial={backdropClassName ? false : { opacity: 0 }}
          animate={backdropClassName ? undefined : { opacity: 1 }}
          exit={backdropClassName ? undefined : { opacity: 0 }}
          transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
          onMouseDown={
            dismissable && !backdropClassName
              ? event => {
                  if (event.target === event.currentTarget) {
                    onClose();
                  }
                }
              : undefined
          }
        >
          {backdropClassName ? (
            <motion.div
              aria-hidden="true"
              className={cn('absolute inset-0', backdropClassName)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
              onMouseDown={dismissable ? onClose : undefined}
            />
          ) : null}
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
