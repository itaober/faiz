'use client';

import { DismissableLayer, DismissableLayerBranch } from '@radix-ui/react-dismissable-layer';
import { FocusScope } from '@radix-ui/react-focus-scope';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RemoveScroll } from 'react-remove-scroll';

import { ANIMATION } from '@/lib/constants/animation';
import { lockScroll, type ScrollLockMode, unlockScroll } from '@/lib/scroll-lock';
import { cn } from '@/lib/utils';

interface IOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Dialog layout/alignment classes (e.g. centering and padding). */
  className?: string;
  /** Persistent only: a backdrop layer kept separate so content can animate at full opacity. */
  backdropClassName?: string;
  /** Persistent only: controls the backdrop while the modal and scroll lock stay active. */
  backdropOpen?: boolean;
  ariaLabel?: string;
  /** Id of the element that describes the dialog, announced after its label. */
  ariaDescribedBy?: string;
  /** Hand focus back to what had it before opening. Off for the public search, which never did. */
  returnFocus?: boolean;
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
  ariaDescribedBy,
  returnFocus = false,
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
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

  // A persistent overlay stays mounted while closed, so it can't sit in the layer stack below and
  // listens for Escape itself. On body rather than document: a layer opened on top (the search
  // palette) takes Escape at document first and stops or handles it there. Install before paint so
  // Escape can reverse even the first opening frame.
  useLayoutEffect(() => {
    if (!persistent || !open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.body.addEventListener('keydown', onKey, true);
    return () => document.body.removeEventListener('keydown', onKey, true);
  }, [persistent, open]);

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
        aria-describedby={ariaDescribedBy}
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
              onMouseDown={onClose}
            />
          ) : null}
        </AnimatePresence>
        {children}
      </div>,
      document.body,
    );
  }

  // Joins the Radix layer, focus and scroll-lock stacks the vaul drawers use, so it also works on
  // top of one: it gets the clicks, focus, wheel and Escape, and as a branch its clicks never
  // dismiss the layer below. Page pointer events stay on (the backdrop covers the page anyway), so
  // password-manager menus keep working. Consumers place their own initial focus.
  return createPortal(
    <AnimatePresence onExitComplete={handleExitComplete}>
      {open ? (
        <FocusScope
          asChild
          trapped
          loop
          onMountAutoFocus={event => {
            event.preventDefault();
            const active = document.activeElement;
            returnFocusRef.current = returnFocus && active instanceof HTMLElement ? active : null;
          }}
          onUnmountAutoFocus={event => {
            // Radix would always refocus the trigger and select() a text field; give focus back
            // only when asked, and as it was.
            event.preventDefault();
            returnFocusRef.current?.focus({ preventScroll: true });
          }}
        >
          <DismissableLayer
            asChild
            onEscapeKeyDown={event => {
              event.stopPropagation();
              onClose();
            }}
          >
            <DismissableLayerBranch asChild>
              <RemoveScroll forwardProps allowPinchZoom removeScrollBar={false}>
                <motion.div
                  layoutRoot
                  className={cn('fz-overlay', className)}
                  role="dialog"
                  aria-modal="true"
                  aria-label={ariaLabel}
                  aria-describedby={ariaDescribedBy}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out }}
                  onMouseDown={event => {
                    if (event.target === event.currentTarget) {
                      onClose();
                    }
                  }}
                >
                  {children}
                </motion.div>
              </RemoveScroll>
            </DismissableLayerBranch>
          </DismissableLayer>
        </FocusScope>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
