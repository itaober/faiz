'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import useMeasure from '@/hooks/use-measure';
import { ANIMATION } from '@/lib/constants/animation';
import { cn } from '@/lib/utils';

// Discriminated by placement so a card can only ever carry ONE vertical edge:
// 'above' pins `bottom` (card grows/shrinks upward), 'below' pins `top`. The
// link-side edge must stay put on every frame of the height animation.
type CardPosition =
  | { placement: 'above'; bottom: number; left: number; width: number; maxHeight: number }
  | { placement: 'below'; top: number; left: number; width: number; maxHeight: number };

export interface HoverCardTriggerProps {
  'aria-describedby'?: string;
}

interface HoverCardProps {
  children: (props: HoverCardTriggerProps) => ReactNode;
  content: ReactNode;
  className?: string;
  disabled?: boolean;
  openDelayMs?: number;
  closeDelayMs?: number;
  onOpenChange?: (open: boolean) => void;
}

const CARD_WIDTH = 320;
const CARD_GAP = 10;
const VIEWPORT_PADDING = 16;
const ESTIMATED_CARD_HEIGHT = 144;
const BOUNDS_TRANSITION = {
  duration: ANIMATION.duration.morph,
  ease: ANIMATION.ease.morph,
} as const;

export default function HoverCard({
  children,
  content,
  className,
  disabled = false,
  openDelayMs = 450,
  closeDelayMs = 180,
  onOpenChange,
}: HoverCardProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const placementRef = useRef<'above' | 'below' | null>(null);
  const tooltipId = useId();
  const reducedMotion = useReducedMotion();
  const [contentRef, contentBounds] = useMeasure(content);
  const contentHeight = contentBounds.height;
  const [supportsHover, setSupportsHover] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<CardPosition | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeCard = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    placementRef.current = null;
    setIsOpen(false);
  }, [clearCloseTimer, clearOpenTimer]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(CARD_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
    const left = Math.min(
      window.innerWidth - width - VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, rect.left + rect.width / 2 - width / 2),
    );
    const spaceAbove = Math.max(0, rect.top - CARD_GAP - VIEWPORT_PADDING);
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - CARD_GAP - VIEWPORT_PADDING);
    const placement =
      placementRef.current ??
      (spaceAbove >= ESTIMATED_CARD_HEIGHT || spaceAbove >= spaceBelow ? 'above' : 'below');
    placementRef.current = placement;

    setPosition(
      placement === 'above'
        ? {
            placement,
            bottom: window.innerHeight - rect.top + CARD_GAP,
            left,
            width,
            maxHeight: spaceAbove,
          }
        : { placement, top: rect.bottom + CARD_GAP, left, width, maxHeight: spaceBelow },
    );
  }, []);

  const openCard = useCallback(() => {
    if (disabled || !supportsHover) {
      return;
    }
    clearOpenTimer();
    clearCloseTimer();
    updatePosition();
    setIsOpen(true);
  }, [clearCloseTimer, clearOpenTimer, disabled, supportsHover, updatePosition]);

  const scheduleOpen = useCallback(() => {
    if (disabled || !supportsHover) {
      return;
    }
    clearCloseTimer();
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(openCard, openDelayMs);
  }, [clearCloseTimer, clearOpenTimer, disabled, openCard, openDelayMs, supportsHover]);

  const scheduleClose = useCallback(() => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(closeCard, closeDelayMs);
  }, [clearCloseTimer, clearOpenTimer, closeCard, closeDelayMs]);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => {
      setSupportsHover(query.matches);
      if (!query.matches) {
        clearOpenTimer();
        clearCloseTimer();
        placementRef.current = null;
        setIsOpen(false);
      }
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [clearCloseTimer, clearOpenTimer]);

  useEffect(() => {
    if (disabled) {
      closeCard();
    }
  }, [closeCard, disabled]);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Anchors are computed on open and on window resize only — never from
    // content/request changes, so the link-side edge can't drift mid-morph.
    const handleResize = () => updatePosition();
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && cardRef.current?.contains(event.target)) {
        return;
      }
      closeCard();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCard();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeCard, isOpen, updatePosition]);

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
    };
  }, [clearCloseTimer, clearOpenTimer]);

  const triggerProps: HoverCardTriggerProps = {
    'aria-describedby': supportsHover && !disabled ? tooltipId : undefined,
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="inline"
        onPointerEnter={event => {
          if (event.pointerType !== 'touch') {
            scheduleOpen();
          }
        }}
        onPointerLeave={scheduleClose}
        onFocus={event => {
          if (event.target instanceof HTMLElement && event.target.matches(':focus-visible')) {
            openCard();
          }
        }}
        onBlur={scheduleClose}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            closeCard();
          }
        }}
      >
        {children(triggerProps)}
      </span>
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {isOpen && position ? (
                <motion.div
                  ref={cardRef}
                  id={tooltipId}
                  role="tooltip"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    height:
                      contentHeight > 0 ? Math.min(contentHeight, position.maxHeight) : 'auto',
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    opacity: { duration: ANIMATION.duration.fast, ease: ANIMATION.ease.out },
                    height: reducedMotion ? { duration: 0 } : BOUNDS_TRANSITION,
                  }}
                  style={{
                    left: position.left,
                    width: position.width,
                    // Exactly one vertical edge — the one facing the link —
                    // so the animated height can only move the far edge.
                    ...(position.placement === 'above'
                      ? { bottom: position.bottom }
                      : { top: position.top }),
                  }}
                  onPointerEnter={clearCloseTimer}
                  onPointerLeave={scheduleClose}
                  className={cn(
                    'text-foreground fixed z-60 flex flex-col overflow-hidden rounded-lg text-left shadow-[var(--fz-shadow-lg)]',
                    // Keep the visible card glued to the pinned edge while the
                    // frame's far edge morphs.
                    position.placement === 'above' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    ref={contentRef}
                    style={{ maxHeight: position.maxHeight }}
                    className={cn(
                      'border-border bg-surface overflow-y-auto rounded-lg border p-3',
                      className,
                    )}
                  >
                    {content}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
